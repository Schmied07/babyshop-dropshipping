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


async def refresh_amazon_keepa_data(db):
    """Refresh Amazon/Keepa data for all products with configured ASINs.
    
    This job runs every 6 hours to update current Amazon prices, sales ranks,
    and other marketplace data for comparison with dropshipping costs.
    """
    import keepa_client
    
    # Check if Keepa is configured
    if not keepa_client.is_keepa_configured():
        print("[CRON] Keepa API not configured, skipping Amazon refresh")
        return
    
    updated = 0
    errors = 0
    skipped = 0
    
    try:
        # Find all WooCommerce products with Amazon ASIN configured
        products_with_asin = await db.woo_products.find({
            "amazonData.asin": {"$exists": True, "$ne": None}
        }).to_list(None)
        
        print(f"[CRON] Found {len(products_with_asin)} products with Amazon ASIN configured")
        
        for product in products_with_asin:
            try:
                amazon_data = product.get("amazonData", {})
                asin = amazon_data.get("asin")
                marketplace = amazon_data.get("marketplace", "fr")
                
                if not asin:
                    skipped += 1
                    continue
                
                # Query Keepa for current data
                keepa_data = await keepa_client.query_product_by_asin(
                    asin=asin,
                    marketplace=f"amazon.{marketplace}",
                    api_key=None  # Use configured key
                )
                
                if keepa_data:
                    # Extract relevant pricing data
                    amazon_price = keepa_data.get("amazon_price")
                    buybox_price = keepa_data.get("buybox_price")
                    sales_rank = keepa_data.get("sales_rank")
                    
                    # Use Amazon price if available, otherwise buybox
                    current_price = None
                    if amazon_price and amazon_price > 0:
                        current_price = amazon_price / 100  # Keepa returns prices in cents
                    elif buybox_price and buybox_price > 0:
                        current_price = buybox_price / 100
                    
                    # Update product with fresh data
                    update_data = {
                        "amazonData.currentPrice": current_price,
                        "amazonData.salesRank": sales_rank,
                        "amazonData.lastChecked": utc_now(),
                        "updatedAt": utc_now()
                    }
                    
                    # Calculate Amazon margin if we have supplier cost
                    if current_price and product.get("supplierMappings"):
                        # Get primary supplier cost
                        primary_mapping = next(
                            (m for m in product["supplierMappings"] if m.get("priority") == 1),
                            None
                        )
                        if primary_mapping:
                            # This would need supplier product lookup for actual cost
                            # For now, we just store the Amazon price for comparison
                            pass
                    
                    await db.woo_products.update_one(
                        {"_id": product["_id"]},
                        {"$set": update_data}
                    )
                    updated += 1
                    
                    # Small delay to respect Keepa rate limits
                    await asyncio.sleep(1)
                else:
                    errors += 1
                    print(f"[CRON] Failed to fetch Keepa data for ASIN {asin}")
                    
            except Exception as e:
                errors += 1
                print(f"[CRON] Error refreshing ASIN {amazon_data.get('asin')}: {e}")
                continue
        
        # Create notification
        if updated > 0 or errors > 0:
            await db.notifications.insert_one({
                "type": "price_change" if errors == 0 else "sync_error",
                "severity": "info" if errors == 0 else "warning",
                "title": "Rafraîchissement Amazon/Keepa",
                "message": f"{updated} produits mis à jour · {errors} erreurs · {skipped} ignorés",
                "link": "/woocommerce",
                "read": False,
                "createdAt": utc_now(),
            })
        
        # Log execution
        await db.sync_jobs.insert_one({
            "type": "keepa_refresh",
            "productsUpdated": updated,
            "errors": errors,
            "skipped": skipped,
            "createdAt": utc_now(),
        })
        
        print(f"[CRON] Keepa refresh done: {updated} updated, {errors} errors, {skipped} skipped")
        
    except Exception as e:
        print(f"[CRON] Keepa refresh job error: {e}")
        await db.notifications.insert_one({
            "type": "sync_error",
            "severity": "critical",
            "title": "Erreur rafraîchissement Amazon",
            "message": f"Le job de rafraîchissement Keepa a échoué: {str(e)}",
            "link": "/woocommerce",
            "read": False,
            "createdAt": utc_now(),
        })


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
    keepa_hours = int(os.environ.get("KEEPA_REFRESH_HOURS", "6"))
    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(
        sync_stocks_and_prices, IntervalTrigger(hours=hours),
        args=[db], id="stocks_prices_sync", replace_existing=True,
    )
    _scheduler.add_job(
        import_woo_orders, IntervalTrigger(minutes=30),
        args=[db], id="wc_orders_import", replace_existing=True,
    )
    _scheduler.add_job(
        refresh_amazon_keepa_data, IntervalTrigger(hours=keepa_hours),
        args=[db], id="keepa_amazon_refresh", replace_existing=True,
    )
    _scheduler.start()
    print(f"[CRON] Scheduler started: sync every {hours}h, WC orders poll every 30min, Keepa refresh every {keepa_hours}h")
    return _scheduler


def get_scheduler():
    return _scheduler
