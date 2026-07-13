"""One-off migrations for EuropaDrop. Usage:
  python migrations.py pricelock --dry-run
  python migrations.py pricelock --apply
  python migrations.py categories --dry-run   (reports messy categories)
Run against whatever MONGO_URL/DB_NAME are in backend/.env.
"""
import os
import sys
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()
client = AsyncIOMotorClient(os.environ.get("MONGO_URL"))
db = client[os.environ.get("DB_NAME")]


async def pricelock(apply: bool):
    # Products with a manual retail price but no lock flag.
    # Only lock products that have NO supplier mapping (purely manual) to avoid
    # freezing auto-priced products.
    total = await db.products.count_documents({})
    candidates = []
    async for p in db.products.find({
        "retailPrice": {"$gt": 0},
        "$or": [{"priceLocked": {"$exists": False}}, {"priceLocked": False}],
    }):
        pid = str(p["_id"])
        sp_count = await db.supplier_products.count_documents({"productId": pid})
        if sp_count == 0:
            candidates.append(pid)
    print(f"Total products: {total}")
    print(f"Manual products (retailPrice>0, unlocked, no supplier mapping): {len(candidates)}")
    if apply and candidates:
        res = await db.products.update_many(
            {"_id": {"$in": [__import__('bson').ObjectId(c) for c in candidates]}},
            {"$set": {"priceLocked": True}},
        )
        print(f"APPLIED: locked {res.modified_count} products.")
    elif not apply:
        print("DRY-RUN: no changes written. Re-run with --apply to lock these.")


MESSY = {"gtin", "ean", "sku", "upc", "mpn", "barcode", "id", "reference", "ref", ""}


async def categories(apply: bool):
    cats = await db.products.distinct("category")
    cats = [c for c in cats if c is not None]
    print(f"Distinct categories in DB: {len(cats)}")
    messy = [c for c in cats if str(c).strip().lower() in MESSY]
    print(f"Messy/invalid categories: {messy}")
    for c in sorted(cats):
        n = await db.products.count_documents({"category": c})
        print(f"  {c!r}: {n}")
    print("DRY-RUN only. Category normalization is done per-user via the UI (/import -> normalize).")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    apply = "--apply" in sys.argv
    if cmd == "pricelock":
        asyncio.run(pricelock(apply))
    elif cmd == "categories":
        asyncio.run(categories(apply))
    else:
        print(__doc__)
