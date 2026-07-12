"""MarcherBien Dropship - FastAPI backend."""
import os
import hmac
import hashlib
import base64
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, Query, UploadFile, File, Form, BackgroundTasks, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

load_dotenv()

from models import (  # noqa: E402
    Supplier, Product, SupplierProduct, PricingRule, Order,
    Notification, ProductMapping, UserLogin, UserRegister, UserPublic,
    utc_now,
)
from auth import (  # noqa: E402
    hash_password, verify_password, create_access_token, get_current_user,
)
from pricing import compute_retail_price, find_best_rule, auto_select_supplier  # noqa: E402
from catalog_import import parse_catalog, detect_columns, auto_suggest_mapping, coerce_row  # noqa: E402
import woocommerce as wc  # noqa: E402
import deepseek  # noqa: E402
from scheduler import start_scheduler, sync_stocks_and_prices, import_woo_orders  # noqa: E402
from api_keys import (  # noqa: E402
    AVAILABLE_SCOPES, EVENT_TYPES, generate_api_key, generate_secret,
    get_current_principal, require_scope, dispatch_event,
)

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(
    title="EuropaDrop API",
    version="1.3.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)
app.state.db = db

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- API Key scope enforcement middleware ----------
# Maps URL path prefix + method → required scope
SCOPE_MAP = [
    # (method, path_pattern, scope)
    ("GET", "/api/products", "products.read"),
    ("POST", "/api/products", "products.write"),
    ("PUT", "/api/products", "products.write"),
    ("DELETE", "/api/products", "products.write"),
    ("GET", "/api/suppliers", "suppliers.read"),
    ("POST", "/api/suppliers", "suppliers.write"),
    ("PUT", "/api/suppliers", "suppliers.write"),
    ("DELETE", "/api/suppliers", "suppliers.write"),
    ("GET", "/api/supplier-products", "supplier_products.read"),
    ("POST", "/api/supplier-products", "supplier_products.write"),
    ("PUT", "/api/supplier-products", "supplier_products.write"),
    ("DELETE", "/api/supplier-products", "supplier_products.write"),
    ("GET", "/api/orders", "orders.read"),
    ("POST", "/api/orders", "orders.write"),
    ("PUT", "/api/orders", "orders.write"),
    ("POST", "/api/orders/bulk-fulfill", "orders.write"),
    ("PUT", "/api/orders/{oid_}/payment", "orders.payment"),
    ("POST", "/api/orders/{oid_}/tracking", "orders.tracking"),
    ("GET", "/api/pricing-rules", "pricing_rules.read"),
    ("POST", "/api/pricing-rules", "pricing_rules.write"),
    ("PUT", "/api/pricing-rules", "pricing_rules.write"),
    ("DELETE", "/api/pricing-rules", "pricing_rules.write"),
    ("POST", "/api/catalog", "catalog.import"),
    ("GET", "/api/catalog/history", "catalog.import"),
    ("POST", "/api/woocommerce/sync", "sync.run"),
    ("PUT", "/api/woocommerce/sync", "sync.run"),
    ("GET", "/api/woocommerce/status", "sync.status"),
    ("GET", "/api/woocommerce/orders", "sync.status"),
    ("POST", "/api/ai/translate", "ai.translate"),
    ("POST", "/api/ai/bulk-translate", "ai.translate"),
    ("POST", "/api/ai/seo", "ai.seo"),
    ("POST", "/api/ai/smart-mapping", "ai.mapping"),
    ("GET", "/api/webhooks", "webhooks.manage"),
    ("POST", "/api/webhooks", "webhooks.manage"),
    ("GET", "/api/outbound-webhooks", "webhooks.manage"),
    ("POST", "/api/outbound-webhooks", "webhooks.manage"),
    ("PUT", "/api/outbound-webhooks", "webhooks.manage"),
    ("DELETE", "/api/outbound-webhooks", "webhooks.manage"),
    ("GET", "/api/notifications", "notifications.read"),
    ("GET", "/api/dashboard", "dashboard.read"),
]


def _required_scope(method: str, path: str) -> Optional[str]:
    for m, prefix, scope in SCOPE_MAP:
        if method == m and path.startswith(prefix):
            return scope
    return None


@app.middleware("http")
async def api_key_scope_middleware(request: Request, call_next):
    # Only enforce on /api/* paths with api_key auth
    path = request.url.path
    auth = request.headers.get("authorization", "")
    if not (path.startswith("/api/") and auth.startswith("Bearer ed_")):
        return await call_next(request)

    # Extract key + look up scopes
    token = auth.split(" ", 1)[1] if " " in auth else ""
    if not token.startswith("ed_"):
        return await call_next(request)
    key_hash = hashlib.sha256(token.encode()).hexdigest()
    api_key = await db.api_keys.find_one({"key_hash": key_hash, "revoked": {"$ne": True}})
    if not api_key:
        return await call_next(request)  # let auth reject with 401

    scopes = set(api_key.get("scopes", []))
    if "*" in scopes:
        return await call_next(request)

    required = _required_scope(request.method, path)
    if required is None:
        # Endpoint not in map — allow (e.g., /health, /auth/me)
        return await call_next(request)

    # Check scope with fallback: write grants read
    if required not in scopes:
        base = required.split(".")[0]
        if required.endswith(".read") and f"{base}.write" in scopes:
            return await call_next(request)
        return JSONResponse(
            status_code=403,
            content={
                "detail": f"Scope requis: {required}",
                "current_scopes": sorted(scopes),
                "hint": "Créez une nouvelle clé API avec ce scope, ou utilisez une clé avec '*'",
            },
        )
    return await call_next(request)


# ---------- Helpers ----------
def oid(v: str) -> ObjectId:
    if not ObjectId.is_valid(v):
        raise HTTPException(400, f"ID invalide: {v}")
    return ObjectId(v)


def doc_to_json(doc: dict) -> dict:
    if not doc:
        return doc
    d = dict(doc)
    if "_id" in d:
        d["id"] = str(d.pop("_id"))
    for k, v in list(d.items()):
        if isinstance(v, ObjectId):
            d[k] = str(v)
        elif isinstance(v, datetime):
            d[k] = v.isoformat()
    return d


async def load_active_pricing_rules() -> List[PricingRule]:
    rules = []
    async for r in db.pricing_rules.find({"isActive": True}):
        rules.append(PricingRule.from_mongo(r))
    return rules


async def refresh_product_aggregates(product_id: str):
    """Recompute a product's cost/stock/retail from supplier products + pricing rules."""
    sps = await db.supplier_products.find({"productId": product_id}).to_list(None)
    prod = await db.products.find_one({"_id": oid(product_id)})
    if not prod:
        return
    if not sps:
        await db.products.update_one({"_id": oid(product_id)}, {"$set": {"costPrice": 0, "stock": 0, "retailPrice": 0}})
        return
    best_cost = min(sp["costPrice"] for sp in sps)
    total_stock = sum(sp.get("stock", 0) for sp in sps)
    rules = await load_active_pricing_rules()
    rule = find_best_rule(rules, prod.get("category"), None)
    retail = compute_retail_price(best_cost, rule)
    await db.products.update_one(
        {"_id": oid(product_id)},
        {"$set": {"costPrice": best_cost, "stock": total_stock, "retailPrice": retail}},
    )
    # Low stock notif
    if total_stock < 10:
        existing = await db.notifications.find_one({
            "type": "low_stock", "read": False, "message": {"$regex": prod.get("sku", "")}
        })
        if not existing:
            await db.notifications.insert_one({
                "type": "low_stock",
                "severity": "critical" if total_stock < 5 else "warning",
                "title": "Stock bas",
                "message": f"{prod.get('name')} ({prod.get('sku')}) : {total_stock} unités",
                "link": "/catalogue",
                "read": False,
                "createdAt": utc_now(),
            })
            # Fire outbound event
            await dispatch_event(db, "low_stock", {
                "productId": product_id, "sku": prod.get("sku"),
                "name": prod.get("name"), "stock": total_stock,
                "threshold": 10,
            })


# ---------- Health ----------
@app.get("/api/health")
async def health():
    try:
        await db.command("ping")
        mongo = "connected"
    except Exception:
        mongo = "disconnected"
    return {
        "status": "ok",
        "mongodb": mongo,
        "woocommerce": "configured" if wc.is_configured() else "not_configured",
        "deepseek": "configured" if deepseek.is_configured() else "not_configured",
        "timestamp": utc_now().isoformat(),
    }


# ========== AUTH ==========
class LoginResponse(BaseModel):
    token: str
    user: UserPublic


@app.post("/api/auth/register", response_model=LoginResponse)
async def register(payload: UserRegister):
    if await db.users.find_one({"email": payload.email}):
        raise HTTPException(400, "Email déjà enregistré")
    doc = {
        "email": payload.email,
        "name": payload.name,
        "password_hash": hash_password(payload.password),
        "role": "admin",
        "created_at": utc_now(),
    }
    r = await db.users.insert_one(doc)
    uid = str(r.inserted_id)
    token = create_access_token(uid, payload.email, "admin")
    return LoginResponse(token=token, user=UserPublic(id=uid, email=payload.email, name=payload.name, role="admin"))


@app.post("/api/auth/login", response_model=LoginResponse)
async def login(payload: UserLogin):
    user = await db.users.find_one({"email": payload.email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(401, "Identifiants invalides")
    token = create_access_token(str(user["_id"]), user["email"], user.get("role", "admin"))
    return LoginResponse(token=token, user=UserPublic(
        id=str(user["_id"]), email=user["email"], name=user["name"], role=user.get("role", "admin"),
    ))


@app.get("/api/auth/me", response_model=UserPublic)
async def me(current=Depends(get_current_user)):
    user = await db.users.find_one({"_id": oid(current["id"])})
    if not user:
        raise HTTPException(404, "Utilisateur non trouvé")
    return UserPublic(id=str(user["_id"]), email=user["email"], name=user["name"], role=user.get("role", "admin"))


# ========== SUPPLIERS ==========
@app.get("/api/suppliers")
async def list_suppliers(active_only: bool = False, _=Depends(get_current_user)):
    q = {"isActive": True} if active_only else {}
    docs = await db.suppliers.find(q).to_list(None)
    return {"success": True, "count": len(docs), "data": [doc_to_json(d) for d in docs]}


@app.get("/api/suppliers/{sid}")
async def get_supplier(sid: str, _=Depends(get_current_user)):
    doc = await db.suppliers.find_one({"_id": oid(sid)})
    if not doc:
        raise HTTPException(404, "Fournisseur non trouvé")
    return doc_to_json(doc)


@app.post("/api/suppliers")
async def create_supplier(payload: Supplier, _=Depends(get_current_user)):
    doc = payload.to_mongo()
    doc["lastUpdated"] = utc_now()
    r = await db.suppliers.insert_one(doc)
    doc["_id"] = r.inserted_id
    return doc_to_json(doc)


@app.put("/api/suppliers/{sid}")
async def update_supplier(sid: str, payload: dict, _=Depends(get_current_user)):
    payload["lastUpdated"] = utc_now()
    await db.suppliers.update_one({"_id": oid(sid)}, {"$set": payload})
    doc = await db.suppliers.find_one({"_id": oid(sid)})
    return doc_to_json(doc)


@app.delete("/api/suppliers/{sid}")
async def delete_supplier(sid: str, _=Depends(get_current_user)):
    await db.suppliers.delete_one({"_id": oid(sid)})
    return {"success": True}


# ========== PRODUCTS ==========
@app.get("/api/products")
async def list_products(
    page: int = 1, limit: int = 50, q: Optional[str] = None,
    category: Optional[str] = None,
    sync_status: Optional[str] = None,  # 'imported' | 'published' | 'not_published'
    _=Depends(get_current_user),
):
    filt: dict = {}
    if q:
        filt["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"sku": {"$regex": q, "$options": "i"}}]
    if category:
        filt["category"] = category

    # sync_status filter uses join with product_mappings
    if sync_status:
        synced_ids = set()
        async for m in db.product_mappings.find({"lastSyncStatus": {"$in": ["success", "mocked"]}}):
            synced_ids.add(m["internalProductId"])
        if sync_status == "published":
            filt["_id"] = {"$in": [oid(i) for i in synced_ids]}
        elif sync_status in ("imported", "not_published"):
            filt["_id"] = {"$nin": [oid(i) for i in synced_ids]}

    total = await db.products.count_documents(filt)
    skip = (page - 1) * limit
    docs = await db.products.find(filt).skip(skip).limit(limit).sort("createdAt", -1).to_list(None)

    # Enrich each with sync status
    all_mappings = {}
    async for m in db.product_mappings.find({}):
        all_mappings[m["internalProductId"]] = m

    result = []
    for d in docs:
        j = doc_to_json(d)
        mp = all_mappings.get(str(d["_id"]))
        j["wooSynced"] = bool(mp and mp.get("lastSyncStatus") in ("success", "mocked"))
        j["wpProductId"] = mp.get("wpProductId") if mp else None
        j["lastSyncStatus"] = mp.get("lastSyncStatus") if mp else None
        j["syncedAt"] = mp.get("syncedAt").isoformat() if mp and mp.get("syncedAt") else None
        result.append(j)

    return {
        "success": True,
        "pagination": {"total": total, "page": page, "pages": max(1, (total + limit - 1) // limit)},
        "data": result,
    }


@app.get("/api/products/stats")
async def products_stats(_=Depends(get_current_user)):
    total = await db.products.count_documents({})
    active = await db.products.count_documents({"isActive": True})
    synced_ids = set()
    async for m in db.product_mappings.find({"lastSyncStatus": {"$in": ["success", "mocked"]}}):
        synced_ids.add(m["internalProductId"])
    published = len(synced_ids)
    return {
        "total": total,
        "active": active,
        "published": published,
        "not_published": total - published,
    }


@app.get("/api/products/{pid}")
async def get_product(pid: str, _=Depends(get_current_user)):
    doc = await db.products.find_one({"_id": oid(pid)})
    if not doc:
        raise HTTPException(404, "Produit non trouvé")
    sps = await db.supplier_products.find({"productId": pid}).to_list(None)
    # Enrich with supplier names
    supplier_ids = list({sp["supplierId"] for sp in sps})
    suppliers_map = {}
    if supplier_ids:
        for s in await db.suppliers.find({"_id": {"$in": [oid(i) for i in supplier_ids]}}).to_list(None):
            suppliers_map[str(s["_id"])] = s.get("name", "")
    sps_enriched = []
    for sp in sps:
        d = doc_to_json(sp)
        d["supplierNameFull"] = suppliers_map.get(sp["supplierId"], "")
        sps_enriched.append(d)
    mapping = await db.product_mappings.find_one({"internalProductId": pid})
    return {
        "product": doc_to_json(doc),
        "suppliers": sps_enriched,
        "wooMapping": doc_to_json(mapping) if mapping else None,
    }


@app.post("/api/products")
async def create_product(payload: Product, _=Depends(get_current_user)):
    doc = payload.to_mongo()
    doc["createdAt"] = utc_now()
    r = await db.products.insert_one(doc)
    doc["_id"] = r.inserted_id
    return doc_to_json(doc)


@app.put("/api/products/{pid}")
async def update_product(pid: str, payload: dict, _=Depends(get_current_user)):
    await db.products.update_one({"_id": oid(pid)}, {"$set": payload})
    await refresh_product_aggregates(pid)
    doc = await db.products.find_one({"_id": oid(pid)})
    return doc_to_json(doc)


@app.delete("/api/products/{pid}")
async def delete_product(pid: str, _=Depends(get_current_user)):
    await db.products.delete_one({"_id": oid(pid)})
    await db.supplier_products.delete_many({"productId": pid})
    return {"success": True}


# ========== SUPPLIER PRODUCTS (multi-supplier mapping) ==========
@app.get("/api/supplier-products")
async def list_supplier_products(
    supplierId: Optional[str] = None, productId: Optional[str] = None,
    _=Depends(get_current_user),
):
    filt = {}
    if supplierId:
        filt["supplierId"] = supplierId
    if productId:
        filt["productId"] = productId
    docs = await db.supplier_products.find(filt).to_list(None)
    return {"success": True, "count": len(docs), "data": [doc_to_json(d) for d in docs]}


@app.post("/api/supplier-products")
async def create_supplier_product(payload: SupplierProduct, _=Depends(get_current_user)):
    doc = payload.to_mongo()
    doc["lastUpdated"] = utc_now()
    r = await db.supplier_products.insert_one(doc)
    doc["_id"] = r.inserted_id
    await refresh_product_aggregates(payload.productId)
    return doc_to_json(doc)


@app.put("/api/supplier-products/{spid}")
async def update_supplier_product(spid: str, payload: dict, _=Depends(get_current_user)):
    payload["lastUpdated"] = utc_now()
    await db.supplier_products.update_one({"_id": oid(spid)}, {"$set": payload})
    doc = await db.supplier_products.find_one({"_id": oid(spid)})
    await refresh_product_aggregates(doc["productId"])
    return doc_to_json(doc)


@app.delete("/api/supplier-products/{spid}")
async def delete_supplier_product(spid: str, _=Depends(get_current_user)):
    doc = await db.supplier_products.find_one({"_id": oid(spid)})
    if doc:
        await db.supplier_products.delete_one({"_id": oid(spid)})
        await refresh_product_aggregates(doc["productId"])
    return {"success": True}


@app.get("/api/products/{pid}/best-supplier")
async def best_supplier(pid: str, strategy: str = "cheapest", _=Depends(get_current_user)):
    docs = await db.supplier_products.find({"productId": pid}).to_list(None)
    sps = [SupplierProduct.from_mongo(d) for d in docs]
    best = auto_select_supplier(sps, strategy)
    if not best:
        return {"best": None}
    supplier = await db.suppliers.find_one({"_id": oid(best.supplierId)})
    d = best.model_dump()
    d["supplierNameFull"] = supplier.get("name") if supplier else ""
    return {"strategy": strategy, "best": d}


# ========== PRICING RULES ==========
@app.get("/api/pricing-rules")
async def list_rules(_=Depends(get_current_user)):
    docs = await db.pricing_rules.find().sort("priority", -1).to_list(None)
    return {"success": True, "data": [doc_to_json(d) for d in docs]}


@app.post("/api/pricing-rules")
async def create_rule(payload: PricingRule, _=Depends(get_current_user)):
    doc = payload.to_mongo()
    doc["createdAt"] = utc_now()
    r = await db.pricing_rules.insert_one(doc)
    doc["_id"] = r.inserted_id
    return doc_to_json(doc)


@app.put("/api/pricing-rules/{rid}")
async def update_rule(rid: str, payload: dict, _=Depends(get_current_user)):
    await db.pricing_rules.update_one({"_id": oid(rid)}, {"$set": payload})
    doc = await db.pricing_rules.find_one({"_id": oid(rid)})
    return doc_to_json(doc)


@app.delete("/api/pricing-rules/{rid}")
async def delete_rule(rid: str, _=Depends(get_current_user)):
    await db.pricing_rules.delete_one({"_id": oid(rid)})
    return {"success": True}


@app.post("/api/pricing-rules/apply-all")
async def apply_all_rules(_=Depends(get_current_user)):
    """Recompute retail price of all products with active rules."""
    count = 0
    async for prod in db.products.find({}):
        await refresh_product_aggregates(str(prod["_id"]))
        count += 1
    return {"success": True, "updated": count}


# ========== CATALOG IMPORT ==========
class ImportPreview(BaseModel):
    filename: str
    format: str
    columns: List[str]
    suggested_mapping: dict
    preview_rows: List[dict]
    total_rows: int


@app.post("/api/catalog/preview", response_model=ImportPreview)
async def catalog_preview(file: UploadFile = File(...), _=Depends(get_current_user)):
    content = await file.read()
    name = file.filename or "catalog"
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if ext in ("csv",):
        fmt = "csv"
    elif ext in ("xlsx", "xls"):
        fmt = "xlsx"
    elif ext == "json":
        fmt = "json"
    elif ext == "xml":
        fmt = "xml"
    else:
        raise HTTPException(400, "Format non supporté (utilisez csv, xlsx, json, xml)")
    try:
        rows = parse_catalog(content, fmt)
    except Exception as e:
        raise HTTPException(400, f"Erreur parsing: {e}")
    columns = detect_columns(rows)
    mapping = auto_suggest_mapping(columns)
    return ImportPreview(
        filename=name, format=fmt, columns=columns,
        suggested_mapping=mapping, preview_rows=rows[:5], total_rows=len(rows),
    )


class CatalogImportPayload(BaseModel):
    supplierId: str
    filename: str
    format: str
    mapping: dict
    rows: List[dict]


@app.post("/api/catalog/import")
async def catalog_import(payload: CatalogImportPayload, _=Depends(get_current_user)):
    return await _do_catalog_import(payload)


async def _do_catalog_import(payload: CatalogImportPayload):
    """Import rows for a supplier. Creates products if missing, updates supplier_products."""
    supplier = await db.suppliers.find_one({"_id": oid(payload.supplierId)})
    if not supplier:
        raise HTTPException(404, "Fournisseur non trouvé")

    imported, updated, errors = 0, 0, []
    affected_products: set = set()
    for i, raw in enumerate(payload.rows):
        try:
            row = coerce_row(raw, payload.mapping)
            sup_sku = row.get("supplierSku") or f"AUTO-{i}"
            name = row.get("name") or "Produit sans nom"
            cost = float(row.get("costPrice", 0))
            stock = int(row.get("stock", 0))
            category = row.get("category") or None
            brand = row.get("brand") or None

            # find or create product by SKU heuristic (using supplierSku or brand+name)
            internal_sku = f"{payload.supplierId[:6]}-{sup_sku}".upper().replace(" ", "-")[:64]
            prod = await db.products.find_one({
                "$or": [{"sku": internal_sku}, {"name": name, "brand": brand or ""}]
            })
            if prod:
                pid = str(prod["_id"])
                await db.products.update_one({"_id": prod["_id"]}, {"$set": {
                    "name": name, "category": category or prod.get("category"), "brand": brand or prod.get("brand"),
                }})
            else:
                doc = {
                    "sku": internal_sku, "name": name, "category": category, "brand": brand,
                    "description": row.get("description", ""), "images": [], "isActive": True,
                    "stock": 0, "costPrice": 0, "retailPrice": 0, "createdAt": utc_now(),
                }
                r = await db.products.insert_one(doc)
                pid = str(r.inserted_id)

            # upsert supplier_product
            existing = await db.supplier_products.find_one({"supplierId": payload.supplierId, "supplierSku": sup_sku})
            sp_doc = {
                "supplierId": payload.supplierId, "productId": pid,
                "supplierSku": sup_sku, "supplierName": name,
                "costPrice": cost, "stock": stock,
                "minOrder": int(row.get("moq", 1)), "moq": int(row.get("moq", 1)),
                "leadTime": {"min": int(row.get("leadTimeDays", 3)), "max": int(row.get("leadTimeDays", 5)) + 2, "unit": "days"},
                "packaging": {"unit": "carton", "quantity": int(row.get("packageQty", 1)) or 1},
                "available": True, "priority": 0, "lastUpdated": utc_now(),
            }
            if existing:
                await db.supplier_products.update_one({"_id": existing["_id"]}, {"$set": sp_doc})
                updated += 1
            else:
                await db.supplier_products.insert_one(sp_doc)
                imported += 1
            affected_products.add(pid)
        except Exception as e:
            errors.append(f"Ligne {i+1}: {e}")

    # Refresh aggregates
    for pid in affected_products:
        await refresh_product_aggregates(pid)

    # Log import job
    await db.catalog_imports.insert_one({
        "supplierId": payload.supplierId, "filename": payload.filename, "format": payload.format,
        "mapping": payload.mapping, "totalRows": len(payload.rows),
        "imported": imported, "updated": updated, "errors": errors[:20],
        "status": "completed", "createdAt": utc_now(),
    })
    return {"success": True, "imported": imported, "updated": updated, "errors": errors[:20], "total": len(payload.rows)}


@app.post("/api/catalog/import-file")
async def catalog_import_file(
    file: UploadFile = File(...),
    supplierId: str = Form(...),
    mapping: str = Form(...),
    _=Depends(get_current_user),
):
    """Import full catalog file directly (parses server-side)."""
    import json as _json
    supplier = await db.suppliers.find_one({"_id": oid(supplierId)})
    if not supplier:
        raise HTTPException(404, "Fournisseur non trouvé")
    content = await file.read()
    name = file.filename or "catalog"
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    fmt = {"csv": "csv", "xlsx": "xlsx", "xls": "xlsx", "json": "json", "xml": "xml"}.get(ext)
    if not fmt:
        raise HTTPException(400, "Format non supporté")
    try:
        rows = parse_catalog(content, fmt)
        mapping_dict = _json.loads(mapping)
    except Exception as e:
        raise HTTPException(400, f"Erreur: {e}")

    payload = CatalogImportPayload(
        supplierId=supplierId, filename=name, format=fmt,
        mapping=mapping_dict, rows=rows,
    )
    return await _do_catalog_import(payload)


@app.get("/api/catalog/history")
async def import_history(_=Depends(get_current_user)):
    docs = await db.catalog_imports.find().sort("createdAt", -1).limit(20).to_list(None)
    return {"success": True, "data": [doc_to_json(d) for d in docs]}


# ========== ORDERS ==========
@app.get("/api/orders")
async def list_orders(status: Optional[str] = None, _=Depends(get_current_user)):
    filt = {}
    if status:
        filt["status"] = status
    docs = await db.orders.find(filt).sort("createdAt", -1).to_list(None)
    return {"success": True, "count": len(docs), "data": [doc_to_json(d) for d in docs]}


@app.get("/api/orders/{oid_}")
async def get_order(oid_: str, _=Depends(get_current_user)):
    doc = await db.orders.find_one({"_id": oid(oid_)})
    if not doc:
        raise HTTPException(404, "Commande non trouvée")
    return doc_to_json(doc)


@app.post("/api/orders")
async def create_order(payload: dict, _=Depends(get_current_user)):
    payload["createdAt"] = utc_now()
    payload["updatedAt"] = utc_now()
    if "orderNumber" not in payload:
        count = await db.orders.count_documents({})
        payload["orderNumber"] = f"MB-2026-{count+1:04d}"
    r = await db.orders.insert_one(payload)
    payload["_id"] = r.inserted_id
    return doc_to_json(payload)


@app.put("/api/orders/{oid_}")
async def update_order(oid_: str, payload: dict, _=Depends(get_current_user)):
    payload["updatedAt"] = utc_now()
    await db.orders.update_one({"_id": oid(oid_)}, {"$set": payload})
    doc = await db.orders.find_one({"_id": oid(oid_)})
    return doc_to_json(doc)


class BulkFulfillPayload(BaseModel):
    orderIds: List[str]
    strategy: str = "cheapest"


@app.post("/api/orders/bulk-fulfill")
async def bulk_fulfill(payload: BulkFulfillPayload, _=Depends(get_current_user)):
    """Auto-fulfill orders: pick best supplier per line, mark as in_progress."""
    results = []
    for oid_ in payload.orderIds:
        order = await db.orders.find_one({"_id": oid(oid_)})
        if not order:
            results.append({"orderId": oid_, "status": "not_found"})
            continue
        updated_items = []
        for item in order.get("items", []):
            docs = await db.supplier_products.find({"productId": item.get("productId")}).to_list(None)
            sps = [SupplierProduct.from_mongo(d) for d in docs]
            best = auto_select_supplier(sps, payload.strategy)
            item = dict(item)
            if best:
                item["supplierId"] = best.supplierId
                item["supplierSku"] = best.supplierSku
                item["supplierCost"] = best.costPrice
                # decrement supplier stock
                await db.supplier_products.update_one(
                    {"supplierId": best.supplierId, "productId": item["productId"]},
                    {"$inc": {"stock": -item.get("quantity", 1)}},
                )
                await refresh_product_aggregates(item["productId"])
            updated_items.append(item)
        await db.orders.update_one(
            {"_id": oid(oid_)},
            {"$set": {
                "items": updated_items, "status": "processing",
                "fulfillmentStatus": "in_progress", "updatedAt": utc_now(),
            }},
        )
        results.append({"orderId": oid_, "status": "fulfilled", "items": len(updated_items)})
    return {"success": True, "results": results}


class TrackingPayload(BaseModel):
    trackingNumber: str
    trackingCarrier: Optional[str] = "Colissimo"


@app.post("/api/orders/{oid_}/tracking")
async def set_tracking(oid_: str, payload: TrackingPayload, _=Depends(get_current_user)):
    await db.orders.update_one({"_id": oid(oid_)}, {"$set": {
        "trackingNumber": payload.trackingNumber, "trackingCarrier": payload.trackingCarrier,
        "status": "shipped", "fulfillmentStatus": "fulfilled", "updatedAt": utc_now(),
    }})
    order = await db.orders.find_one({"_id": oid(oid_)})
    await dispatch_event(db, "order.shipped", doc_to_json(order))
    return {"success": True}


# ========== WOOCOMMERCE SYNC ==========
@app.get("/api/woocommerce/status")
async def woo_status(_=Depends(get_current_user)):
    stores_count = await db.stores.count_documents({"isActive": True})
    legacy = wc.is_configured()
    if not stores_count and not legacy:
        return {"configured": False, "stores_count": 0}
    reachable = False
    try:
        creds = wc._default_creds()
        if stores_count:
            s = await db.stores.find_one({"isActive": True})
            if s:
                creds = {"url": s["url"], "key": s["key"], "secret": s["secret"]}
        if creds:
            r = await wc.wc_get("/products", params={"per_page": 1}, creds=creds)
            reachable = r.status_code < 400
    except Exception:
        reachable = False
    return {
        "configured": True,
        "stores_count": stores_count,
        "legacy_env_configured": legacy,
        "reachable": reachable,
    }


@app.post("/api/woocommerce/sync-product/{pid}")
async def woo_sync_product(pid: str, store_id: Optional[str] = None, _=Depends(get_current_user)):
    return await woo_sync_product_internal(pid, store_id)


async def _get_target_stores(store_id: Optional[str] = None) -> list:
    """Return list of stores to sync to (specific or all active)."""
    stores = []
    if store_id:
        s = await db.stores.find_one({"_id": oid(store_id)})
        if s and s.get("isActive"):
            stores.append(s)
    else:
        async for s in db.stores.find({"isActive": True}):
            stores.append(s)
    # Fallback to env legacy store
    if not stores and wc.is_configured():
        creds = wc._default_creds()
        stores.append({"_id": None, "name": "default", "url": creds["url"], "key": creds["key"], "secret": creds["secret"]})
    return stores


async def woo_sync_product_internal(pid: str, store_id: Optional[str] = None):
    prod = await db.products.find_one({"_id": oid(pid)})
    if not prod:
        raise HTTPException(404, "Produit non trouvé")

    stores = await _get_target_stores(store_id)
    if not stores:
        return {"success": False, "error": "Aucune boutique configurée"}

    results = []
    for store in stores:
        creds = {"url": store["url"], "key": store["key"], "secret": store["secret"]}
        sid = str(store["_id"]) if store.get("_id") else None
        payload = {
            "name": prod.get("name"), "type": "simple",
            "regular_price": str(prod.get("retailPrice", 0)),
            "description": prod.get("description", ""),
            "sku": prod.get("sku"), "manage_stock": True,
            "stock_quantity": prod.get("stock", 0), "status": "publish",
            "images": [{"src": u} for u in prod.get("images", []) if u],
        }
        mapping_query = {"internalProductId": pid}
        if sid:
            mapping_query["storeId"] = sid
        mapping = await db.product_mappings.find_one(mapping_query)
        try:
            if mapping and mapping.get("wpProductId"):
                r = await wc.wc_put(f"/products/{mapping['wpProductId']}", payload, creds=creds)
            else:
                r = await wc.wc_post("/products", payload, creds=creds)
            if r.status_code >= 400:
                err = r.text[:300]
                await db.product_mappings.update_one(
                    mapping_query,
                    {"$set": {**mapping_query, "storeId": sid, "storeName": store.get("name"),
                             "lastSyncStatus": "error", "lastSyncError": err, "syncedAt": utc_now()}},
                    upsert=True,
                )
                results.append({"store": store.get("name"), "success": False, "error": err})
                continue
            data = r.json()
            await db.product_mappings.update_one(
                mapping_query,
                {"$set": {
                    **mapping_query, "storeId": sid, "storeName": store.get("name"),
                    "wpProductId": data.get("id"), "wpSku": data.get("sku"),
                    "wpStatus": data.get("status"), "wpPrice": float(data.get("price", 0) or 0),
                    "wpStock": data.get("stock_quantity") or 0,
                    "syncedAt": utc_now(), "lastSyncStatus": "success", "lastSyncError": None,
                }},
                upsert=True,
            )
            results.append({"store": store.get("name"), "success": True, "wpProductId": data.get("id")})
            await dispatch_event(db, "product.published", {
                "productId": pid, "storeId": sid, "wpProductId": data.get("id"),
            })
        except Exception as e:
            results.append({"store": store.get("name"), "success": False, "error": str(e)})

    return {"success": any(r["success"] for r in results), "results": results}


@app.post("/api/woocommerce/sync-all")
async def woo_sync_all(_=Depends(get_current_user)):
    prods = await db.products.find({"isActive": True}).to_list(None)
    results = {"total": len(prods), "success": 0, "errors": 0}
    for p in prods:
        r = await woo_sync_product_internal(str(p["_id"]))
        if r.get("success"):
            results["success"] += 1
        else:
            results["errors"] += 1
    return results


@app.put("/api/woocommerce/sync-stock/{wp_product_id}")
async def woo_sync_stock(wp_product_id: int, stock: int, _=Depends(get_current_user)):
    if not wc.is_configured():
        return {"success": True, "mocked": True}
    r = await wc.wc_put(f"/products/{wp_product_id}", {"stock_quantity": stock})
    return {"success": r.status_code < 400, "status_code": r.status_code}


@app.get("/api/woocommerce/orders")
async def woo_orders(limit: int = 20, _=Depends(get_current_user)):
    if not wc.is_configured():
        return {"success": False, "message": "WooCommerce non configuré"}
    try:
        r = await wc.wc_get("/orders", params={"per_page": limit, "orderby": "date", "order": "desc"})
        if r.status_code >= 400:
            return {"success": False, "status_code": r.status_code, "error": r.text[:300]}
        return {"success": True, "data": r.json()}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ========== NOTIFICATIONS ==========
@app.get("/api/notifications")
async def list_notifications(unread_only: bool = False, _=Depends(get_current_user)):
    filt = {"read": False} if unread_only else {}
    docs = await db.notifications.find(filt).sort("createdAt", -1).limit(50).to_list(None)
    unread = await db.notifications.count_documents({"read": False})
    return {"success": True, "unread": unread, "data": [doc_to_json(d) for d in docs]}


@app.put("/api/notifications/{nid}/read")
async def mark_read(nid: str, _=Depends(get_current_user)):
    await db.notifications.update_one({"_id": oid(nid)}, {"$set": {"read": True}})
    return {"success": True}


@app.post("/api/notifications/mark-all-read")
async def mark_all_read(_=Depends(get_current_user)):
    await db.notifications.update_many({}, {"$set": {"read": True}})
    return {"success": True}


# ========== DASHBOARD & ANALYTICS ==========
@app.get("/api/dashboard/overview")
async def dashboard_overview(_=Depends(get_current_user)):
    total_products = await db.products.count_documents({})
    total_suppliers = await db.suppliers.count_documents({"isActive": True})
    total_orders = await db.orders.count_documents({})
    pending_orders = await db.orders.count_documents({"status": "pending"})

    orders = await db.orders.find({}).to_list(None)
    revenue = sum(o.get("total", 0) for o in orders)
    cost = sum(sum(i.get("supplierCost", 0) * i.get("quantity", 1) for i in o.get("items", [])) for o in orders)
    margin = revenue - cost
    margin_percent = (margin / revenue * 100) if revenue > 0 else 0

    low_stock = await db.products.find({"stock": {"$lt": 10}}).to_list(None)
    unread_notifs = await db.notifications.count_documents({"read": False})

    # Top products by quantity in orders
    top_map: dict = {}
    for o in orders:
        for it in o.get("items", []):
            k = it.get("sku") or it.get("productId")
            top_map.setdefault(k, {"sku": it.get("sku"), "name": it.get("name"), "qty": 0, "revenue": 0})
            top_map[k]["qty"] += it.get("quantity", 0)
            top_map[k]["revenue"] += it.get("quantity", 0) * it.get("price", 0)
    top_products = sorted(top_map.values(), key=lambda x: x["revenue"], reverse=True)[:5]

    # Revenue by day (last 14 days)
    from collections import defaultdict
    by_day = defaultdict(lambda: {"date": "", "revenue": 0, "orders": 0})
    for o in orders:
        d = o.get("createdAt")
        if isinstance(d, datetime):
            key = d.date().isoformat()
        else:
            key = str(d)[:10]
        by_day[key]["date"] = key
        by_day[key]["revenue"] += o.get("total", 0)
        by_day[key]["orders"] += 1
    revenue_series = sorted(by_day.values(), key=lambda x: x["date"])[-14:]

    return {
        "metrics": {
            "totalProducts": total_products,
            "totalSuppliers": total_suppliers,
            "totalOrders": total_orders,
            "pendingOrders": pending_orders,
            "revenue": round(revenue, 2),
            "margin": round(margin, 2),
            "marginPercent": round(margin_percent, 1),
            "lowStockCount": len(low_stock),
            "unreadNotifications": unread_notifs,
        },
        "lowStockItems": [doc_to_json(p) for p in low_stock[:5]],
        "topProducts": top_products,
        "revenueSeries": revenue_series,
    }


@app.get("/api/dashboard/supplier-performance")
async def supplier_performance(_=Depends(get_current_user)):
    suppliers = await db.suppliers.find({}).to_list(None)
    result = []
    for s in suppliers:
        sid = str(s["_id"])
        sps = await db.supplier_products.find({"supplierId": sid}).to_list(None)
        product_count = len(sps)
        avg_lead = sum((sp.get("leadTime", {}) or {}).get("max", 0) for sp in sps) / product_count if product_count else 0
        total_stock = sum(sp.get("stock", 0) for sp in sps)
        avg_cost = sum(sp.get("costPrice", 0) for sp in sps) / product_count if product_count else 0
        result.append({
            "supplierId": sid, "name": s.get("name"), "country": s.get("country"),
            "products": product_count, "avgLeadTime": round(avg_lead, 1),
            "totalStock": total_stock, "avgCost": round(avg_cost, 2), "rating": s.get("rating", 0),
        })
    return {"success": True, "data": result}


# ========== PAYMENT STATUS ==========
class PaymentUpdate(BaseModel):
    paymentStatus: str  # unpaid | paid | refunded | partial_refund
    paymentMethod: Optional[str] = None
    paymentReference: Optional[str] = None


@app.put("/api/orders/{oid_}/payment")
async def update_payment(oid_: str, payload: PaymentUpdate, _=Depends(get_current_user)):
    update = payload.model_dump(exclude_none=True)
    update["updatedAt"] = utc_now()
    if payload.paymentStatus == "paid":
        update["paidAt"] = utc_now()
    await db.orders.update_one({"_id": oid(oid_)}, {"$set": update})
    if payload.paymentStatus == "paid":
        order = await db.orders.find_one({"_id": oid(oid_)})
        await dispatch_event(db, "order.paid", doc_to_json(order))
    return {"success": True}


# ========== DEEPSEEK AI ==========
class TranslatePayload(BaseModel):
    text: str
    source_lang: str = "auto"


@app.post("/api/ai/translate")
async def ai_translate(payload: TranslatePayload, _=Depends(get_current_user)):
    if not deepseek.is_configured():
        raise HTTPException(400, "DeepSeek non configuré")
    try:
        translated = await deepseek.translate_to_french(payload.text, payload.source_lang)
        return {"success": True, "translated": translated}
    except Exception as e:
        raise HTTPException(500, str(e))


class SEOPayload(BaseModel):
    productId: Optional[str] = None
    name: str
    category: str = ""
    brand: str = ""
    features: str = ""


@app.post("/api/ai/seo-description")
async def ai_seo(payload: SEOPayload, _=Depends(get_current_user)):
    if not deepseek.is_configured():
        raise HTTPException(400, "DeepSeek non configuré")
    try:
        result = await deepseek.generate_seo_description(
            payload.name, payload.category, payload.brand, payload.features
        )
        if payload.productId:
            await db.products.update_one(
                {"_id": oid(payload.productId)},
                {"$set": {
                    "seoTitle": result.get("seo_title"),
                    "metaDescription": result.get("meta_description"),
                    "description": result.get("description"),
                    "keywords": result.get("keywords", []),
                }},
            )
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(500, str(e))


class SmartMapPayload(BaseModel):
    columns: List[str]
    sample_rows: List[dict] = []


@app.post("/api/ai/smart-mapping")
async def ai_smart_mapping(payload: SmartMapPayload, _=Depends(get_current_user)):
    if not deepseek.is_configured():
        raise HTTPException(400, "DeepSeek non configuré")
    try:
        mapping = await deepseek.smart_column_mapping(payload.columns, payload.sample_rows)
        return {"success": True, "mapping": mapping}
    except Exception as e:
        raise HTTPException(500, str(e))


class BulkTranslatePayload(BaseModel):
    productIds: List[str]


@app.post("/api/ai/bulk-translate-products")
async def ai_bulk_translate(payload: BulkTranslatePayload, _=Depends(get_current_user)):
    if not deepseek.is_configured():
        raise HTTPException(400, "DeepSeek non configuré")
    updated = 0
    errors = []
    for pid in payload.productIds:
        try:
            prod = await db.products.find_one({"_id": oid(pid)})
            if not prod:
                continue
            new_name = await deepseek.translate_to_french(prod.get("name", ""))
            new_desc = await deepseek.translate_to_french(prod.get("description", "")) if prod.get("description") else ""
            await db.products.update_one(
                {"_id": oid(pid)},
                {"$set": {"name": new_name, "description": new_desc}},
            )
            updated += 1
        except Exception as e:
            errors.append(f"{pid}: {e}")
    return {"success": True, "updated": updated, "errors": errors[:5]}


# ========== WOOCOMMERCE WEBHOOKS ==========
def _verify_wc_signature(body: bytes, signature: Optional[str], secret: str) -> bool:
    """Verify WooCommerce webhook HMAC-SHA256 signature."""
    if not secret or not signature:
        return True  # Allow if secret not set (dev/test)
    expected = base64.b64encode(hmac.new(secret.encode(), body, hashlib.sha256).digest()).decode()
    return hmac.compare_digest(expected, signature)


async def _get_webhook_secret() -> str:
    """Fetch webhook secret from DB settings, fallback to env."""
    doc = await db.app_settings.find_one({"key": "webhook_secret"})
    if doc and doc.get("value"):
        return doc["value"]
    return os.environ.get("WP_WEBHOOK_SECRET", "")


@app.post("/api/webhooks/woocommerce/orders")
async def wc_webhook_orders(request: Request, x_wc_webhook_signature: Optional[str] = Header(None)):
    """Receive order.created/updated webhook from WooCommerce."""
    body = await request.body()
    secret = await _get_webhook_secret()
    if not _verify_wc_signature(body, x_wc_webhook_signature, secret):
        raise HTTPException(401, "Invalid signature")
    try:
        wp_order = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON")

    wp_id = wp_order.get("id")
    if not wp_id:
        return {"received": True, "ignored": True}

    from scheduler import _map_wc_status
    billing = wp_order.get("billing", {})
    items = [{
        "productId": "", "sku": li.get("sku", ""), "name": li.get("name", ""),
        "quantity": li.get("quantity", 1), "price": float(li.get("price", 0) or 0),
        "supplierCost": 0,
    } for li in wp_order.get("line_items", [])]

    doc = {
        "orderNumber": f"WP-{wp_id}",
        "wpOrderId": wp_id,
        "customerName": f"{billing.get('first_name', '')} {billing.get('last_name', '')}".strip() or "Client WP",
        "customerEmail": billing.get("email", ""),
        "shippingAddress": wp_order.get("shipping", {}),
        "items": items,
        "total": float(wp_order.get("total", 0) or 0),
        "status": _map_wc_status(wp_order.get("status", "pending")),
        "paymentStatus": "paid" if wp_order.get("date_paid") else "unpaid",
        "paymentMethod": wp_order.get("payment_method_title", ""),
        "updatedAt": utc_now(),
    }
    result = await db.orders.update_one(
        {"wpOrderId": wp_id},
        {"$set": doc, "$setOnInsert": {"createdAt": utc_now(), "fulfillmentStatus": "unfulfilled"}},
        upsert=True,
    )
    if result.upserted_id:
        await db.notifications.insert_one({
            "type": "order_new", "severity": "info",
            "title": "Nouvelle commande WooCommerce",
            "message": f"Commande WP-{wp_id} de {doc['customerName']} · {doc['total']}€",
            "link": "/commandes", "read": False, "createdAt": utc_now(),
        })
        # Dispatch outbound event
        created_doc = await db.orders.find_one({"_id": result.upserted_id})
        await dispatch_event(db, "order.created", doc_to_json(created_doc))
    else:
        updated_doc = await db.orders.find_one({"wpOrderId": wp_id})
        await dispatch_event(db, "order.updated", doc_to_json(updated_doc))
    return {"received": True, "created": bool(result.upserted_id), "updated": not result.upserted_id}


@app.get("/api/webhooks/woocommerce/info")
async def wc_webhook_info(_=Depends(get_current_user)):
    """Returns webhook URL + secret to configure in WooCommerce admin."""
    base = os.environ.get("APP_URL", "").rstrip("/")
    secret = await _get_webhook_secret()
    return {
        "url": f"{base}/api/webhooks/woocommerce/orders",
        "secret": secret,
        "events": ["order.created", "order.updated"],
        "instructions": (
            "Dans WordPress Admin : WooCommerce → Réglages → Avancé → Webhooks → Ajouter. "
            "Utiliser l'URL et le secret ci-dessus. Sujet : Commande créée + Commande mise à jour. "
            "Version API : WP REST API Integration v3."
        ),
    }


@app.post("/api/webhooks/woocommerce/regenerate-secret")
async def wc_regenerate_secret(_=Depends(get_current_user)):
    """Generate a new webhook secret, store it, return it."""
    new_secret = generate_secret()
    await db.app_settings.update_one(
        {"key": "webhook_secret"},
        {"$set": {"key": "webhook_secret", "value": new_secret, "updatedAt": utc_now()}},
        upsert=True,
    )
    base = os.environ.get("APP_URL", "").rstrip("/")
    return {
        "success": True,
        "secret": new_secret,
        "url": f"{base}/api/webhooks/woocommerce/orders",
        "message": "Nouveau secret généré. Mettez-le à jour dans WordPress → WooCommerce → Webhooks.",
    }


# ========== API KEYS (scoped external access — Claude, n8n, etc.) ==========
class ApiKeyCreate(BaseModel):
    name: str
    scopes: List[str]
    description: Optional[str] = None


@app.get("/api/api-keys")
async def list_api_keys(_=Depends(get_current_user)):
    docs = await db.api_keys.find().sort("createdAt", -1).to_list(None)
    result = []
    for d in docs:
        d = doc_to_json(d)
        d.pop("key_hash", None)
        result.append(d)
    return {"success": True, "data": result, "available_scopes": AVAILABLE_SCOPES}


@app.post("/api/api-keys")
async def create_api_key(payload: ApiKeyCreate, _=Depends(get_current_user)):
    invalid = [s for s in payload.scopes if s not in AVAILABLE_SCOPES]
    if invalid:
        raise HTTPException(400, f"Scopes invalides: {invalid}")
    raw, key_hash = generate_api_key()
    doc = {
        "name": payload.name,
        "description": payload.description,
        "key_hash": key_hash,
        "keyPrefix": raw[:12] + "…",
        "scopes": payload.scopes,
        "revoked": False,
        "createdAt": utc_now(),
        "lastUsedAt": None,
    }
    r = await db.api_keys.insert_one(doc)
    return {
        "success": True, "id": str(r.inserted_id), "name": payload.name,
        "key": raw, "keyPrefix": doc["keyPrefix"], "scopes": payload.scopes,
        "warning": "Copiez cette clé maintenant. Elle ne sera plus jamais affichée.",
    }


@app.post("/api/api-keys/{kid}/revoke")
async def revoke_api_key(kid: str, _=Depends(get_current_user)):
    await db.api_keys.update_one({"_id": oid(kid)}, {"$set": {"revoked": True, "revokedAt": utc_now()}})
    return {"success": True}


@app.delete("/api/api-keys/{kid}")
async def delete_api_key(kid: str, _=Depends(get_current_user)):
    await db.api_keys.delete_one({"_id": oid(kid)})
    return {"success": True}


@app.get("/api/api-keys/scopes")
async def list_scopes(_=Depends(get_current_user)):
    return {"scopes": AVAILABLE_SCOPES}


# ========== OUTBOUND WEBHOOKS (n8n, Zapier, Make) ==========
class OutboundWebhookCreate(BaseModel):
    name: str
    url: str
    events: List[str]
    active: bool = True


@app.get("/api/outbound-webhooks")
async def list_outbound(_=Depends(get_current_user)):
    docs = await db.outbound_webhooks.find().sort("createdAt", -1).to_list(None)
    return {
        "success": True, "data": [doc_to_json(d) for d in docs],
        "available_events": EVENT_TYPES,
    }


@app.post("/api/outbound-webhooks")
async def create_outbound(payload: OutboundWebhookCreate, _=Depends(get_current_user)):
    invalid = [e for e in payload.events if e not in EVENT_TYPES]
    if invalid:
        raise HTTPException(400, f"Événements inconnus: {invalid}")
    secret = generate_secret()
    doc = {
        "name": payload.name, "url": payload.url, "events": payload.events,
        "active": payload.active, "secret": secret,
        "deliveryCount": 0, "errorCount": 0,
        "lastFiredAt": None, "lastStatus": None, "lastError": None,
        "createdAt": utc_now(),
    }
    r = await db.outbound_webhooks.insert_one(doc)
    doc["_id"] = r.inserted_id
    return doc_to_json(doc)


@app.put("/api/outbound-webhooks/{wid}")
async def update_outbound(wid: str, payload: dict, _=Depends(get_current_user)):
    payload.pop("secret", None)
    payload.pop("createdAt", None)
    await db.outbound_webhooks.update_one({"_id": oid(wid)}, {"$set": payload})
    doc = await db.outbound_webhooks.find_one({"_id": oid(wid)})
    return doc_to_json(doc)


@app.delete("/api/outbound-webhooks/{wid}")
async def delete_outbound(wid: str, _=Depends(get_current_user)):
    await db.outbound_webhooks.delete_one({"_id": oid(wid)})
    return {"success": True}


@app.post("/api/outbound-webhooks/{wid}/test")
async def test_outbound(wid: str, _=Depends(get_current_user)):
    doc = await db.outbound_webhooks.find_one({"_id": oid(wid)})
    if not doc:
        raise HTTPException(404, "Webhook non trouvé")
    import httpx, json as _json, hmac as _hmac, hashlib as _hashlib
    body = _json.dumps({
        "event": "test", "timestamp": utc_now().isoformat(),
        "data": {"message": "Ping de test depuis EuropaDrop"},
    })
    headers = {"Content-Type": "application/json", "X-Event-Type": "test"}
    if doc.get("secret"):
        sig = _hmac.new(doc["secret"].encode(), body.encode(), _hashlib.sha256).hexdigest()
        headers["X-EuropaDrop-Signature"] = sig
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(doc["url"], content=body, headers=headers)
        ok = r.status_code < 400
        await db.outbound_webhooks.update_one(
            {"_id": oid(wid)},
            {"$set": {
                "lastFiredAt": utc_now(), "lastStatus": r.status_code,
                "lastError": None if ok else r.text[:300],
            }},
        )
        return {"success": ok, "status_code": r.status_code, "response": r.text[:300]}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ========== n8n / OpenAPI integration helper ==========
@app.get("/api/integrations/n8n/info")
async def n8n_info(_=Depends(get_current_user)):
    """Instructions + endpoints to connect n8n."""
    base = os.environ.get("APP_URL", "").rstrip("/")
    return {
        "swagger_docs": f"{base}/api/docs",
        "openapi_spec": f"{base}/api/openapi.json",
        "api_base": f"{base}/api",
        "auth_method": "Bearer API key (préfixe ed_)",
        "example_curl": f"curl -H 'Authorization: Bearer ed_YOUR_KEY' {base}/api/products",
        "steps": [
            "1) Dans EuropaDrop, créez une clé API scopée (Clés API → Nouvelle clé).",
            "2) Dans n8n, ajoutez un HTTP Request node.",
            "3) Authentication : Header Auth. Name : Authorization. Value : Bearer ed_VOTRE_CLE",
            "4) Base URL : " + base + "/api",
            "5) Pour recevoir des événements EuropaDrop dans n8n : créez un Webhook trigger dans n8n, puis un webhook sortant dans EuropaDrop pointant vers son URL.",
        ],
    }


# ========== STORES (multi-boutique WooCommerce) ==========
class StoreCreate(BaseModel):
    name: str
    url: str  # e.g. https://marcherbien.fr/wp-json/wc/v3
    key: str  # consumer key
    secret: str  # consumer secret
    isDefault: bool = False
    isActive: bool = True


@app.get("/api/stores")
async def list_stores(_=Depends(get_current_user)):
    docs = await db.stores.find().sort("createdAt", -1).to_list(None)
    result = []
    for d in docs:
        j = doc_to_json(d)
        j.pop("secret", None)  # never expose secret
        j["keyPreview"] = (j.get("key") or "")[:10] + "…"
        j.pop("key", None)
        result.append(j)
    # Also expose legacy env store info if present
    legacy = wc._default_creds()
    return {"success": True, "data": result, "legacy_env_configured": bool(legacy)}


@app.post("/api/stores")
async def create_store(payload: StoreCreate, _=Depends(get_current_user)):
    # Test creds (non-blocking — save with warning if fail)
    test = await wc.test_connection({"url": payload.url.rstrip("/"), "key": payload.key, "secret": payload.secret})

    if payload.isDefault:
        await db.stores.update_many({}, {"$set": {"isDefault": False}})
    doc = {
        "name": payload.name, "url": payload.url.rstrip("/"),
        "key": payload.key, "secret": payload.secret,
        "isDefault": payload.isDefault, "isActive": payload.isActive,
        "createdAt": utc_now(), "lastTestedAt": utc_now(),
        "lastTestStatus": "success" if test["reachable"] else "error",
        "lastTestError": test.get("error"),
    }
    r = await db.stores.insert_one(doc)
    return {
        "success": True, "id": str(r.inserted_id), "test": test,
        "warning": None if test["reachable"] else f"Boutique enregistrée mais connexion échouée : {test.get('error', '')}",
    }


@app.put("/api/stores/{sid}")
async def update_store(sid: str, payload: dict, _=Depends(get_current_user)):
    if payload.get("isDefault"):
        await db.stores.update_many({}, {"$set": {"isDefault": False}})
    payload["updatedAt"] = utc_now()
    await db.stores.update_one({"_id": oid(sid)}, {"$set": payload})
    return {"success": True}


@app.post("/api/stores/{sid}/test")
async def test_store(sid: str, _=Depends(get_current_user)):
    s = await db.stores.find_one({"_id": oid(sid)})
    if not s:
        raise HTTPException(404, "Boutique non trouvée")
    result = await wc.test_connection({"url": s["url"], "key": s["key"], "secret": s["secret"]})
    await db.stores.update_one({"_id": oid(sid)}, {"$set": {
        "lastTestedAt": utc_now(),
        "lastTestStatus": "success" if result["reachable"] else "error",
        "lastTestError": result.get("error"),
    }})
    return result


@app.delete("/api/stores/{sid}")
async def delete_store(sid: str, _=Depends(get_current_user)):
    await db.stores.delete_one({"_id": oid(sid)})
    # Also delete related mappings
    await db.product_mappings.delete_many({"storeId": sid})
    return {"success": True}


# ========== USERS (multi-user management) ==========
class UserInvite(BaseModel):
    email: str
    name: str
    password: str
    role: str = "operator"  # admin | operator


@app.get("/api/users")
async def list_users(current=Depends(get_current_user)):
    if current.get("role") != "admin":
        raise HTTPException(403, "Réservé aux admins")
    docs = await db.users.find().sort("created_at", -1).to_list(None)
    result = []
    for d in docs:
        d.pop("password_hash", None)
        result.append(doc_to_json(d))
    return {"success": True, "data": result}


@app.post("/api/users")
async def create_user(payload: UserInvite, current=Depends(get_current_user)):
    if current.get("role") != "admin":
        raise HTTPException(403, "Réservé aux admins")
    if payload.role not in ("admin", "operator"):
        raise HTTPException(400, "Rôle doit être 'admin' ou 'operator'")
    if await db.users.find_one({"email": payload.email}):
        raise HTTPException(400, "Email déjà utilisé")
    doc = {
        "email": payload.email, "name": payload.name,
        "password_hash": hash_password(payload.password),
        "role": payload.role, "created_at": utc_now(),
        "createdBy": current["id"],
    }
    r = await db.users.insert_one(doc)
    return {"success": True, "id": str(r.inserted_id)}


@app.put("/api/users/{uid}")
async def update_user(uid: str, payload: dict, current=Depends(get_current_user)):
    if current.get("role") != "admin" and current["id"] != uid:
        raise HTTPException(403, "Non autorisé")
    # Prevent role escalation if not admin
    if current.get("role") != "admin":
        payload.pop("role", None)
    if "password" in payload and payload["password"]:
        payload["password_hash"] = hash_password(payload["password"])
    payload.pop("password", None)
    await db.users.update_one({"_id": oid(uid)}, {"$set": payload})
    return {"success": True}


@app.delete("/api/users/{uid}")
async def delete_user(uid: str, current=Depends(get_current_user)):
    if current.get("role") != "admin":
        raise HTTPException(403, "Réservé aux admins")
    if uid == current["id"]:
        raise HTTPException(400, "Vous ne pouvez pas vous supprimer vous-même")
    await db.users.delete_one({"_id": oid(uid)})
    return {"success": True}


# ========== CRON SCHEDULER CONTROL ==========
@app.get("/api/scheduler/status")
async def scheduler_status(_=Depends(get_current_user)):
    from scheduler import get_scheduler
    s = get_scheduler()
    if not s:
        return {"running": False}
    jobs = []
    for j in s.get_jobs():
        jobs.append({
            "id": j.id,
            "next_run": j.next_run_time.isoformat() if j.next_run_time else None,
            "trigger": str(j.trigger),
        })
    return {
        "running": True,
        "cron_hours": int(os.environ.get("SYNC_CRON_HOURS", "6")),
        "jobs": jobs,
    }


@app.post("/api/scheduler/run-now/{job_id}")
async def scheduler_run_now(job_id: str, _=Depends(get_current_user)):
    if job_id == "stocks_prices_sync":
        await sync_stocks_and_prices(db)
        return {"success": True, "job": "stocks_prices_sync"}
    if job_id == "wc_orders_import":
        await import_woo_orders(db)
        return {"success": True, "job": "wc_orders_import"}
    raise HTTPException(404, "Job inconnu")


@app.get("/api/scheduler/history")
async def scheduler_history(_=Depends(get_current_user)):
    docs = await db.sync_jobs.find().sort("createdAt", -1).limit(20).to_list(None)
    return {"success": True, "data": [doc_to_json(d) for d in docs]}


# ========== STARTUP ==========
@app.on_event("startup")
async def startup():
    await db.suppliers.create_index("name")
    await db.products.create_index("sku", unique=True, sparse=True)
    await db.supplier_products.create_index([("supplierId", 1), ("productId", 1)])
    await db.orders.create_index("orderNumber")
    await db.orders.create_index("wpOrderId", sparse=True)
    start_scheduler(db)
    print("✓ EuropaDrop API démarrée")
