"""Seed initial data for MarcherBien Dropship."""
import asyncio
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def utcnow():
    return datetime.now(timezone.utc)


async def seed():
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "marcherbien_dropship")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # Admin user (idempotent)
    admin_email = "admin@marcherbien.fr"
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "email": admin_email,
            "name": "Admin MarcherBien",
            "password_hash": pwd_context.hash("Admin1234!"),
            "role": "admin",
            "created_at": utcnow(),
        })
        print(f"✓ Admin créé: {admin_email} / Admin1234!")
    else:
        # Idempotent : NE PAS réinitialiser le mot de passe d'un compte existant.
        # (permet à l'utilisateur de changer son mot de passe sans qu'il soit écrasé au rebuild)
        print(f"↷ Admin déjà présent ({admin_email}) — mot de passe conservé.")

    # Suppliers
    suppliers_data = [
        {
            "name": "Santé Bébé France", "country": "France",
            "website": "www.santebebefrance.fr", "email": "contact@santebebefrance.fr",
            "phone": "+33 2 41 55 60 00", "minOrderValue": 100,
            "leadTime": {"min": 3, "max": 5, "unit": "days"},
            "shipping": {"countries": ["FR", "BE", "LU", "DE", "NL", "ES", "IT"], "freeShippingAbove": 500, "costPerKg": 0.85, "estimatedDays": 2},
            "paymentMethods": ["SEPA", "Bank Transfer", "Card"],
            "supportedCurrencies": ["EUR"], "catalogUrl": "https://www.santebebefrance.fr/catalogue-professionnel",
            "isActive": True, "rating": 4.7, "reviews": 128, "lastUpdated": utcnow(),
        },
        {
            "name": "Bébé Distribution Europe", "country": "Belgium",
            "website": "www.bebedistribution.be", "email": "orders@bebedistribution.be",
            "phone": "+32 2 722 40 88", "minOrderValue": 150,
            "leadTime": {"min": 2, "max": 4, "unit": "days"},
            "shipping": {"countries": ["BE", "NL", "FR", "DE", "UK", "IT", "ES"], "freeShippingAbove": 750, "costPerKg": 0.95, "estimatedDays": 1},
            "paymentMethods": ["SEPA", "Bank Transfer", "Card"],
            "supportedCurrencies": ["EUR"], "catalogUrl": "https://www.bebedistribution.be/pro",
            "isActive": True, "rating": 4.5, "reviews": 94, "lastUpdated": utcnow(),
        },
        {
            "name": "Pedibaby Ibérica", "country": "Spain",
            "website": "www.pedibabyiberica.es", "email": "ventas@pedibabyiberica.es",
            "phone": "+34 931 123 456", "minOrderValue": 120,
            "leadTime": {"min": 4, "max": 6, "unit": "days"},
            "shipping": {"countries": ["ES", "PT", "FR", "IT"], "freeShippingAbove": 600, "costPerKg": 0.75, "estimatedDays": 3},
            "paymentMethods": ["SEPA", "Bank Transfer"],
            "supportedCurrencies": ["EUR"], "catalogUrl": "https://www.pedibabyiberica.es/catalogo",
            "isActive": True, "rating": 4.6, "reviews": 156, "lastUpdated": utcnow(),
        },
        {
            "name": "Piccolini Italia", "country": "Italy",
            "website": "www.piccoliniitalia.it", "email": "b2b@piccoliniitalia.it",
            "phone": "+39 06 4588 0123", "minOrderValue": 130,
            "leadTime": {"min": 3, "max": 5, "unit": "days"},
            "shipping": {"countries": ["IT", "FR", "DE", "AT", "CH"], "freeShippingAbove": 700, "costPerKg": 0.90, "estimatedDays": 2},
            "paymentMethods": ["SEPA", "Bank Transfer", "Card"],
            "supportedCurrencies": ["EUR"], "catalogUrl": "https://www.piccoliniitalia.it/catalogo-b2b",
            "isActive": True, "rating": 4.4, "reviews": 87, "lastUpdated": utcnow(),
        },
    ]
    supplier_ids = {}
    for s in suppliers_data:
        found = await db.suppliers.find_one({"name": s["name"]})
        if found:
            supplier_ids[s["name"]] = found["_id"]
        else:
            r = await db.suppliers.insert_one(s)
            supplier_ids[s["name"]] = r.inserted_id
    print(f"✓ Fournisseurs: {len(supplier_ids)}")

    # Products
    products_data = [
        {"sku": "HYG-SERUM-0001", "name": "Sérum physiologique stérile 120ml", "category": "Hygiène", "brand": "Laboratoires Saforelle", "description": "Sérum physiologique stérile pour nettoyer les yeux et le nez du bébé", "ageRange": "0-3 mois", "images": ["https://images.unsplash.com/photo-1739973790298-fceedd19cf05?w=400"]},
        {"sku": "HYG-COTON-0001", "name": "Carrés de coton doux bio 100 unités", "category": "Hygiène", "brand": "Laboratoires Saforelle", "description": "Carrés de coton biologique ultra doux", "ageRange": "0-3 mois", "images": ["https://images.unsplash.com/photo-1627808587525-194446b07384?w=400"]},
        {"sku": "HYG-LINGETTES-0001", "name": "Lingettes nettoyantes bébé x80", "category": "Hygiène", "brand": "Laboratoires Saforelle", "description": "Lingettes sans alcool, hypoallergéniques", "ageRange": "3-6 mois", "images": ["https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?w=400"]},
        {"sku": "SOIN-CHANGE-0001", "name": "Crème pour le change 100ml Mustela", "category": "Soins", "brand": "Mustela", "description": "Crème protectrice pour le change", "ageRange": "0-3 mois", "images": ["https://images.unsplash.com/photo-1739973790298-fceedd19cf05?w=400"]},
        {"sku": "SOIN-HYDRA-0001", "name": "Crème hydratante corps 100ml", "category": "Soins", "brand": "Mustela", "description": "Crème hydratante pour bébé", "ageRange": "3-6 mois", "images": ["https://images.unsplash.com/photo-1627808587525-194446b07384?w=400"]},
        {"sku": "BAIN-THERMO-0001", "name": "Thermomètre de bain numérique", "category": "Bain", "brand": "LULA", "description": "Thermomètre numérique avec alarme", "ageRange": "0-3 mois", "images": ["https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?w=400"]},
        {"sku": "BAIN-CAPE-0001", "name": "Cape de bain à capuche 100x100", "category": "Bain", "brand": "Bébé Confort", "description": "Cape de bain douce et absorbante", "ageRange": "3-6 mois", "images": ["https://images.unsplash.com/photo-1739973790298-fceedd19cf05?w=400"]},
        {"sku": "REPAS-BIB-0001", "name": "Lot de 2 biberons 240ml anti-coliques", "category": "Repas", "brand": "Medela", "description": "Biberons Medela anti-coliques", "ageRange": "0-3 mois", "images": ["https://images.unsplash.com/photo-1627808587525-194446b07384?w=400"]},
        {"sku": "REPAS-CHAUFFE-0001", "name": "Chauffe-biberon électrique 2 en 1", "category": "Repas", "brand": "Medela", "description": "Chauffe-biberon avec stérilisateur", "ageRange": "3-6 mois", "images": ["https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?w=400"]},
        {"sku": "DEPL-SAC-0001", "name": "Sac à langer noir avec accessoires", "category": "Déplacement", "brand": "Bébé Confort", "description": "Grand sac à langer avec compartiments isolants", "ageRange": "0-3 mois", "images": ["https://images.unsplash.com/photo-1739973790298-fceedd19cf05?w=400"]},
    ]

    product_ids = {}
    for p in products_data:
        found = await db.products.find_one({"sku": p["sku"]})
        if found:
            product_ids[p["sku"]] = found["_id"]
        else:
            doc = {**p, "isActive": True, "stock": 0, "costPrice": 0, "retailPrice": 0, "createdAt": utcnow()}
            r = await db.products.insert_one(doc)
            product_ids[p["sku"]] = r.inserted_id
    print(f"✓ Produits: {len(product_ids)}")

    # Supplier products (multi-supplier mapping)
    sp_data = [
        # HYG-SERUM: 3 suppliers to demo auto-select
        {"sku": "HYG-SERUM-0001", "supplier": "Santé Bébé France", "supplierSku": "SBF-SERUM-120", "supplierName": "Sérum physiologique 120ml", "costPrice": 0.45, "stock": 500, "moq": 10, "leadDays": [3, 5]},
        {"sku": "HYG-SERUM-0001", "supplier": "Bébé Distribution Europe", "supplierSku": "BDE-SP-120", "supplierName": "Serum Phy 120ml", "costPrice": 0.52, "stock": 340, "moq": 12, "leadDays": [2, 4]},
        {"sku": "HYG-SERUM-0001", "supplier": "Pedibaby Ibérica", "supplierSku": "PBI-SUERO-120", "supplierName": "Suero Fisiológico 120", "costPrice": 0.38, "stock": 150, "moq": 20, "leadDays": [4, 6]},

        {"sku": "HYG-COTON-0001", "supplier": "Santé Bébé France", "supplierSku": "SBF-COTON-100", "supplierName": "Carrés coton bio x100", "costPrice": 0.90, "stock": 320, "moq": 5, "leadDays": [3, 5]},
        {"sku": "HYG-COTON-0001", "supplier": "Piccolini Italia", "supplierSku": "PI-COT-100BIO", "supplierName": "Cotone Bio 100", "costPrice": 1.10, "stock": 210, "moq": 6, "leadDays": [3, 5]},

        {"sku": "HYG-LINGETTES-0001", "supplier": "Bébé Distribution Europe", "supplierSku": "BDE-WIPES-80", "supplierName": "Lingettes x80", "costPrice": 0.75, "stock": 280, "moq": 8, "leadDays": [2, 4]},

        {"sku": "SOIN-CHANGE-0001", "supplier": "Bébé Distribution Europe", "supplierSku": "BDE-CREME-100", "supplierName": "Crème change 100ml", "costPrice": 1.80, "stock": 200, "moq": 8, "leadDays": [2, 4]},
        {"sku": "SOIN-CHANGE-0001", "supplier": "Piccolini Italia", "supplierSku": "PI-CREMA-100", "supplierName": "Crema cambio 100", "costPrice": 2.10, "stock": 160, "moq": 10, "leadDays": [3, 5]},

        {"sku": "SOIN-HYDRA-0001", "supplier": "Piccolini Italia", "supplierSku": "PI-HYDRA-100", "supplierName": "Crema idratante 100", "costPrice": 2.40, "stock": 120, "moq": 10, "leadDays": [3, 5]},

        {"sku": "BAIN-THERMO-0001", "supplier": "Bébé Distribution Europe", "supplierSku": "BDE-THERMO", "supplierName": "Thermomètre digital", "costPrice": 3.20, "stock": 80, "moq": 6, "leadDays": [2, 4]},
        {"sku": "BAIN-CAPE-0001", "supplier": "Santé Bébé France", "supplierSku": "SBF-CAPE-100", "supplierName": "Cape bain 100x100", "costPrice": 4.50, "stock": 3, "moq": 4, "leadDays": [3, 5]},  # low stock alert

        {"sku": "REPAS-BIB-0001", "supplier": "Santé Bébé France", "supplierSku": "SBF-BIB-240", "supplierName": "Biberons 240 x2", "costPrice": 8.50, "stock": 45, "moq": 4, "leadDays": [3, 5]},
        {"sku": "REPAS-CHAUFFE-0001", "supplier": "Bébé Distribution Europe", "supplierSku": "BDE-CHF-2N1", "supplierName": "Chauffe-biberon 2en1", "costPrice": 14.00, "stock": 25, "moq": 3, "leadDays": [2, 4]},
        {"sku": "DEPL-SAC-0001", "supplier": "Pedibaby Ibérica", "supplierSku": "PBI-BAG-NEG", "supplierName": "Bolsa cambiador negro", "costPrice": 11.20, "stock": 60, "moq": 5, "leadDays": [4, 6]},
    ]

    # Clear existing supplier products then reinsert (idempotent-ish)
    await db.supplier_products.delete_many({})
    for sp in sp_data:
        pid = product_ids.get(sp["sku"])
        sid = supplier_ids.get(sp["supplier"])
        if not pid or not sid:
            continue
        await db.supplier_products.insert_one({
            "supplierId": str(sid),
            "productId": str(pid),
            "supplierSku": sp["supplierSku"],
            "supplierName": sp["supplierName"],
            "costPrice": sp["costPrice"],
            "stock": sp["stock"],
            "minOrder": sp["moq"],
            "moq": sp["moq"],
            "leadTime": {"min": sp["leadDays"][0], "max": sp["leadDays"][1], "unit": "days"},
            "packaging": {"unit": "carton", "quantity": 12},
            "available": True,
            "priority": 0,
            "lastUpdated": utcnow(),
        })
    print(f"✓ Supplier products: {len(sp_data)}")

    # Default pricing rule
    if not await db.pricing_rules.find_one({"name": "Marge standard x3"}):
        await db.pricing_rules.insert_one({
            "name": "Marge standard x3",
            "category": None,
            "supplierId": None,
            "markupPercent": 200,
            "roundingRule": "ends_99",
            "minMargin": 1.0,
            "priority": 0,
            "isActive": True,
            "createdAt": utcnow(),
        })
        print("✓ Règle de tarification par défaut créée")

    # Sample orders
    if await db.orders.count_documents({}) == 0:
        base = utcnow()
        sample_orders = [
            {"orderNumber": "MB-2026-0001", "customerName": "Marie Dupont", "customerEmail": "marie@example.com", "items": [{"productId": str(product_ids["HYG-SERUM-0001"]), "sku": "HYG-SERUM-0001", "name": "Sérum physiologique 120ml", "quantity": 2, "price": 1.99, "supplierCost": 0.38}], "total": 3.98, "status": "pending", "fulfillmentStatus": "unfulfilled", "paymentStatus": "paid", "paymentMethod": "Carte Visa", "paymentReference": "STRIPE-A1B2C3", "paidAt": base, "createdAt": base, "updatedAt": base},
            {"orderNumber": "MB-2026-0002", "customerName": "Jean Martin", "customerEmail": "jean@example.com", "items": [{"productId": str(product_ids["SOIN-CHANGE-0001"]), "sku": "SOIN-CHANGE-0001", "name": "Crème change 100ml", "quantity": 1, "price": 6.99, "supplierCost": 1.80}, {"productId": str(product_ids["BAIN-THERMO-0001"]), "sku": "BAIN-THERMO-0001", "name": "Thermomètre bain", "quantity": 1, "price": 12.99, "supplierCost": 3.20}], "total": 19.98, "status": "processing", "fulfillmentStatus": "in_progress", "paymentStatus": "paid", "paymentMethod": "PayPal", "paymentReference": "PP-98765", "paidAt": base, "trackingNumber": "AT123456789FR", "trackingCarrier": "Colissimo", "createdAt": base, "updatedAt": base},
            {"orderNumber": "MB-2026-0003", "customerName": "Sophie Bernard", "customerEmail": "sophie@example.com", "items": [{"productId": str(product_ids["REPAS-BIB-0001"]), "sku": "REPAS-BIB-0001", "name": "Biberons 240ml", "quantity": 1, "price": 29.99, "supplierCost": 8.50}], "total": 29.99, "status": "shipped", "fulfillmentStatus": "fulfilled", "paymentStatus": "paid", "paymentMethod": "Virement SEPA", "paymentReference": "SEPA-XY123", "paidAt": base, "trackingNumber": "AT987654321FR", "trackingCarrier": "Chronopost", "createdAt": base, "updatedAt": base},
            {"orderNumber": "MB-2026-0004", "customerName": "Luc Petit", "customerEmail": "luc@example.com", "items": [{"productId": str(product_ids["HYG-LINGETTES-0001"]), "sku": "HYG-LINGETTES-0001", "name": "Lingettes x80", "quantity": 3, "price": 2.49, "supplierCost": 0.75}], "total": 7.47, "status": "pending", "fulfillmentStatus": "unfulfilled", "paymentStatus": "unpaid", "createdAt": base, "updatedAt": base},
        ]
        await db.orders.insert_many(sample_orders)
        print(f"✓ Commandes exemples: {len(sample_orders)}")

    # Sample notifications
    if await db.notifications.count_documents({}) == 0:
        notifs = [
            {"type": "low_stock", "severity": "critical", "title": "Rupture imminente", "message": "Cape de bain (BAIN-CAPE-0001) : 3 unités restantes", "link": "/catalogue", "read": False, "createdAt": utcnow()},
            {"type": "order_new", "severity": "info", "title": "Nouvelle commande", "message": "Commande MB-2026-0001 reçue de Marie Dupont", "link": "/commandes", "read": False, "createdAt": utcnow()},
            {"type": "sync_error", "severity": "warning", "title": "Synchronisation WooCommerce", "message": "3 produits n'ont pas pu être synchronisés", "link": "/woocommerce", "read": False, "createdAt": utcnow()},
        ]
        await db.notifications.insert_many(notifs)

    # Recompute product aggregates (stock + best cost + retail)
    from pricing import compute_retail_price
    rule_doc = await db.pricing_rules.find_one({"isActive": True})
    class R:
        pass
    rule = None
    if rule_doc:
        rule = type("R", (), {})()
        rule.markupPercent = rule_doc.get("markupPercent", 200)
        rule.roundingRule = rule_doc.get("roundingRule", "ends_99")
        rule.minMargin = rule_doc.get("minMargin", 0)

    async for prod in db.products.find({}):
        sps = await db.supplier_products.find({"productId": str(prod["_id"])}).to_list(None)
        if sps:
            best_cost = min(sp["costPrice"] for sp in sps)
            total_stock = sum(sp["stock"] for sp in sps)
            retail = compute_retail_price(best_cost, rule) if rule else round(best_cost * 3, 2)
            await db.products.update_one(
                {"_id": prod["_id"]},
                {"$set": {"costPrice": best_cost, "stock": total_stock, "retailPrice": retail}},
            )

    print("✅ Seed terminé.")


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    asyncio.run(seed())
