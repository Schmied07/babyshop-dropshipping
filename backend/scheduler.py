"""Scheduled sync jobs — runs every SYNC_CRON_HOURS hours."""
import os
import asyncio
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

_scheduler: AsyncIOScheduler | None = None


def utc_now():
    return datetime.now(timezone.utc)


async def sync_stocks_and_prices(db):
    """Refresh all product aggregates + push stock/price to WooCommerce."""
    from server import refresh_product_aggregates, woo_sync_product_internal
    import woocommerce as wc

    updated = 0
    synced = 0
    errors = 0
    async for prod in db.products.find({"isActive": True}):
        pid = str(prod["_id"])
        await refresh_product_aggregates(pid)
        updated += 1
        if wc.is_configured():
            try:
                r = await woo_sync_product_internal(pid)
                if r.get("success"):
                    synced += 1
                else:
                    errors += 1
            except Exception:
                errors += 1

    await db.notifications.insert_one({
        "type": "sync_error" if errors else "price_change",
        "severity": "warning" if errors else "info",
        "title": "Sync programmée exécutée",
        "message": f"{updated} produits actualisés · {synced} synchronisés WooCommerce · {errors} erreurs",
        "link": "/woocommerce",
        "read": False,
        "createdAt": utc_now(),
    })
    await db.sync_jobs.insert_one({
        "type": "scheduled_sync",
        "productsUpdated": updated, "productsSynced": synced, "errors": errors,
        "createdAt": utc_now(),
    })
    print(f"[CRON] Sync done: {updated} refreshed, {synced} synced, {errors} errors")


async def import_woo_orders(db):
    """Poll WooCommerce for recent orders and import them."""
    import woocommerce as wc
    if not wc.is_configured():
        return
    try:
        r = await wc.wc_get("/orders", params={"per_page": 50, "orderby": "date", "order": "desc"})
        if r.status_code >= 400:
            return
        imported = 0
        for wp_order in r.json():
            existing = await db.orders.find_one({"wpOrderId": wp_order["id"]})
            if existing:
                continue
            items = [{
                "productId": "", "sku": li.get("sku", ""), "name": li.get("name", ""),
                "quantity": li.get("quantity", 1), "price": float(li.get("price", 0) or 0),
                "supplierCost": 0,
            } for li in wp_order.get("line_items", [])]
            billing = wp_order.get("billing", {})
            await db.orders.insert_one({
                "orderNumber": f"WP-{wp_order['id']}",
                "wpOrderId": wp_order["id"],
                "customerName": f"{billing.get('first_name', '')} {billing.get('last_name', '')}".strip() or "Client WP",
                "customerEmail": billing.get("email", ""),
                "shippingAddress": wp_order.get("shipping", {}),
                "items": items,
                "total": float(wp_order.get("total", 0) or 0),
                "status": _map_wc_status(wp_order.get("status", "pending")),
                "fulfillmentStatus": "unfulfilled",
                "paymentStatus": "paid" if wp_order.get("date_paid") else "unpaid",
                "paymentMethod": wp_order.get("payment_method_title", ""),
                "createdAt": utc_now(),
                "updatedAt": utc_now(),
            })
            imported += 1
        if imported > 0:
            await db.notifications.insert_one({
                "type": "order_new", "severity": "info",
                "title": "Nouvelles commandes WooCommerce",
                "message": f"{imported} commandes importées automatiquement",
                "link": "/commandes", "read": False, "createdAt": utc_now(),
            })
        print(f"[CRON] Imported {imported} new WooCommerce orders")
    except Exception as e:
        print(f"[CRON] WC orders import error: {e}")


def _map_wc_status(wc_status: str) -> str:
    return {
        "pending": "pending", "processing": "processing", "on-hold": "pending",
        "completed": "delivered", "cancelled": "cancelled", "refunded": "cancelled",
        "failed": "cancelled",
    }.get(wc_status, "pending")


def start_scheduler(db):
    global _scheduler
    if _scheduler:
        return _scheduler
    hours = int(os.environ.get("SYNC_CRON_HOURS", "6"))
    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(
        sync_stocks_and_prices, IntervalTrigger(hours=hours),
        args=[db], id="stocks_prices_sync", replace_existing=True,
    )
    _scheduler.add_job(
        import_woo_orders, IntervalTrigger(minutes=30),
        args=[db], id="wc_orders_import", replace_existing=True,
    )
    _scheduler.start()
    print(f"[CRON] Scheduler started: sync every {hours}h, WC orders poll every 30min")
    return _scheduler


def get_scheduler():
    return _scheduler
