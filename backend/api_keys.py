"""API keys with scoped permissions + outbound event system."""
import os
import hmac
import hashlib
import secrets as pysecrets
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import HTTPException, Header, Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

JWT_SECRET = os.environ.get("JWT_SECRET")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")


# All available scopes
AVAILABLE_SCOPES = {
    "*": "Accès total (superadmin)",
    "products.read": "Lire les produits",
    "products.write": "Créer/modifier/supprimer produits",
    "suppliers.read": "Lire les fournisseurs",
    "suppliers.write": "Créer/modifier fournisseurs",
    "supplier_products.read": "Lire les mappings",
    "supplier_products.write": "Modifier les mappings",
    "orders.read": "Lire les commandes",
    "orders.write": "Modifier commandes + fulfillment",
    "orders.payment": "Gérer paiements",
    "orders.tracking": "Gérer tracking colis",
    "pricing_rules.read": "Lire règles de prix",
    "pricing_rules.write": "Modifier règles de prix",
    "catalog.import": "Importer catalogues",
    "sync.run": "Lancer sync WooCommerce",
    "sync.status": "Voir statut sync",
    "ai.translate": "Utiliser IA traduction",
    "ai.seo": "Générer descriptions SEO IA",
    "ai.mapping": "Auto-mapping colonnes IA",
    "webhooks.manage": "Gérer webhooks entrants/sortants",
    "notifications.read": "Lire notifications",
    "dashboard.read": "Voir analytics",
}


def utc_now():
    return datetime.now(timezone.utc)


def generate_api_key() -> tuple[str, str]:
    """Generate raw key + its hash. Returns (raw_key, key_hash)."""
    raw = "ed_" + pysecrets.token_urlsafe(32)
    key_hash = hashlib.sha256(raw.encode()).hexdigest()
    return raw, key_hash


def hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def generate_secret() -> str:
    return pysecrets.token_urlsafe(48)


security_optional = HTTPBearer(auto_error=False)


async def get_current_principal(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
) -> dict:
    """Accept BOTH JWT (user) and API keys. Returns dict with type + scopes."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Non authentifié")

    token = credentials.credentials
    db = request.app.state.db

    # API key path: starts with ed_
    if token.startswith("ed_"):
        key_hash = hash_key(token)
        api_key = await db.api_keys.find_one({"key_hash": key_hash, "revoked": {"$ne": True}})
        if not api_key:
            raise HTTPException(status_code=401, detail="Clé API invalide ou révoquée")
        # Update last used (fire and forget)
        await db.api_keys.update_one({"_id": api_key["_id"]}, {"$set": {"lastUsedAt": utc_now()}})
        return {
            "type": "api_key",
            "id": str(api_key["_id"]),
            "name": api_key.get("name", ""),
            "scopes": api_key.get("scopes", []),
        }

    # JWT path
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {
            "type": "user",
            "id": payload["sub"],
            "email": payload["email"],
            "role": payload.get("role", "admin"),
            "scopes": ["*"],  # users are superadmin
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide")


def require_scope(*required_scopes: str):
    """Dependency factory — raises 403 if principal lacks any of the required scopes."""
    async def check(principal: dict = Depends(get_current_principal)) -> dict:
        scopes = set(principal.get("scopes", []))
        if "*" in scopes:
            return principal
        for req in required_scopes:
            if req not in scopes:
                # allow prefix match e.g. having orders.write also grants orders.read
                base = req.split(".")[0]
                if f"{base}.write" in scopes and req.endswith(".read"):
                    continue
                raise HTTPException(
                    status_code=403,
                    detail=f"Scope requis: {req}. Scopes actuels: {sorted(scopes)}",
                )
        return principal
    return check


# ---------- Outbound event dispatcher (n8n, Zapier, Make) ----------
EVENT_TYPES = {
    "order.created": "Nouvelle commande",
    "order.updated": "Commande modifiée",
    "order.shipped": "Commande expédiée",
    "order.paid": "Commande payée",
    "product.created": "Produit créé",
    "product.published": "Produit publié sur WooCommerce",
    "low_stock": "Stock bas détecté",
    "sync.completed": "Sync terminée",
    "supplier.created": "Nouveau fournisseur",
    "catalog.imported": "Catalogue importé",
}


async def dispatch_event(db, event_type: str, payload: dict):
    """Fire an outbound webhook to all subscribed URLs."""
    import httpx
    import asyncio
    import json as _json

    subscribers = await db.outbound_webhooks.find({
        "active": True,
        "events": event_type,
    }).to_list(None)

    if not subscribers:
        return

    body = {
        "event": event_type,
        "timestamp": utc_now().isoformat(),
        "data": payload,
    }
    body_json = _json.dumps(body, default=str)

    async def _send(sub):
        try:
            headers = {"Content-Type": "application/json", "X-Event-Type": event_type}
            if sub.get("secret"):
                sig = hmac.new(
                    sub["secret"].encode(), body_json.encode(), hashlib.sha256
                ).hexdigest()
                headers["X-EuropaDrop-Signature"] = sig
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(sub["url"], headers=headers, content=body_json)
                ok = r.status_code < 400
                await db.outbound_webhooks.update_one(
                    {"_id": sub["_id"]},
                    {"$set": {
                        "lastFiredAt": utc_now(),
                        "lastStatus": r.status_code,
                        "lastError": None if ok else r.text[:300],
                    }, "$inc": {"deliveryCount": 1, "errorCount": 0 if ok else 1}},
                )
        except Exception as e:
            await db.outbound_webhooks.update_one(
                {"_id": sub["_id"]},
                {"$set": {
                    "lastFiredAt": utc_now(), "lastStatus": 0, "lastError": str(e)[:300],
                }, "$inc": {"errorCount": 1}},
            )

    # Fire all in parallel, don't block
    await asyncio.gather(*[_send(s) for s in subscribers], return_exceptions=True)
