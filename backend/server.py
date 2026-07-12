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

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="EuropaDrop API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    return {"success": True}


# ========== WOOCOMMERCE SYNC ==========
@app.get("/api/woocommerce/status")
async def woo_status(_=Depends(get_current_user)):
    if not wc.is_configured():
        return {"configured": False}
    try:
        r = await wc.wc_get("/products", params={"per_page": 1})
        return {"configured": True, "reachable": r.status_code < 400, "status_code": r.status_code}
    except Exception as e:
        return {"configured": True, "reachable": False, "error": str(e)}


@app.post("/api/woocommerce/sync-product/{pid}")
async def woo_sync_product(pid: str, _=Depends(get_current_user)):
    return await woo_sync_product_internal(pid)


async def woo_sync_product_internal(pid: str):
    prod = await db.products.find_one({"_id": oid(pid)})
    if not prod:
        raise HTTPException(404, "Produit non trouvé")
    if not wc.is_configured():
        # Mock success
        await db.product_mappings.update_one(
            {"internalProductId": pid},
            {"$set": {
                "internalProductId": pid, "wpProductId": 90000 + int(str(prod["_id"])[-4:], 16) % 10000,
                "wpSku": prod.get("sku"), "wpStatus": "publish", "wpPrice": prod.get("retailPrice", 0),
                "wpStock": prod.get("stock", 0), "syncedAt": utc_now(), "lastSyncStatus": "mocked",
            }},
            upsert=True,
        )
        return {"success": True, "mocked": True, "message": "Synchronisation simulée (mock)"}

    payload = {
        "name": prod.get("name"),
        "type": "simple",
        "regular_price": str(prod.get("retailPrice", 0)),
        "description": prod.get("description", ""),
        "sku": prod.get("sku"),
        "manage_stock": True,
        "stock_quantity": prod.get("stock", 0),
        "status": "publish",
        "images": [{"src": u} for u in prod.get("images", []) if u],
    }
    mapping = await db.product_mappings.find_one({"internalProductId": pid})
    try:
        if mapping and mapping.get("wpProductId"):
            r = await wc.wc_put(f"/products/{mapping['wpProductId']}", payload)
        else:
            r = await wc.wc_post("/products", payload)
        if r.status_code >= 400:
            err = r.text[:300]
            await db.product_mappings.update_one(
                {"internalProductId": pid},
                {"$set": {"internalProductId": pid, "lastSyncStatus": "error", "lastSyncError": err, "syncedAt": utc_now()}},
                upsert=True,
            )
            return {"success": False, "error": err}
        data = r.json()
        await db.product_mappings.update_one(
            {"internalProductId": pid},
            {"$set": {
                "internalProductId": pid, "wpProductId": data.get("id"), "wpSku": data.get("sku"),
                "wpStatus": data.get("status"), "wpPrice": float(data.get("price", 0) or 0),
                "wpStock": data.get("stock_quantity") or 0,
                "syncedAt": utc_now(), "lastSyncStatus": "success", "lastSyncError": None,
            }},
            upsert=True,
        )
        return {"success": True, "wpProductId": data.get("id")}
    except Exception as e:
        return {"success": False, "error": str(e)}


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
def _verify_wc_signature(body: bytes, signature: Optional[str]) -> bool:
    """Verify WooCommerce webhook HMAC-SHA256 signature."""
    secret = os.environ.get("WP_WEBHOOK_SECRET", "")
    if not secret or not signature:
        return True  # Allow if secret not set (dev/test)
    expected = base64.b64encode(hmac.new(secret.encode(), body, hashlib.sha256).digest()).decode()
    return hmac.compare_digest(expected, signature)


@app.post("/api/webhooks/woocommerce/orders")
async def wc_webhook_orders(request: Request, x_wc_webhook_signature: Optional[str] = Header(None)):
    """Receive order.created/updated webhook from WooCommerce."""
    body = await request.body()
    if not _verify_wc_signature(body, x_wc_webhook_signature):
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
    return {"received": True, "created": bool(result.upserted_id), "updated": not result.upserted_id}


@app.get("/api/webhooks/woocommerce/info")
async def wc_webhook_info(_=Depends(get_current_user)):
    """Returns webhook URL + secret to configure in WooCommerce admin."""
    base = os.environ.get("APP_URL", "").rstrip("/")
    return {
        "url": f"{base}/api/webhooks/woocommerce/orders",
        "secret": os.environ.get("WP_WEBHOOK_SECRET", ""),
        "events": ["order.created", "order.updated"],
        "instructions": (
            "Dans WordPress Admin : WooCommerce → Réglages → Avancé → Webhooks → Ajouter. "
            "Utiliser l'URL et le secret ci-dessus. Sujet : Commande créée + Commande mise à jour. "
            "Version API : WP REST API Integration v3."
        ),
    }


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
