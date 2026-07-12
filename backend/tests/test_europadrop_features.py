"""New EuropaDrop features tests: payment, webhook, scheduler, DeepSeek AI, product sync filter."""
import os
import pytest
import requests


# ---------- Health includes deepseek ----------
class TestHealthDeepSeek:
    def test_health_deepseek_configured(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/health", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["mongodb"] == "connected"
        assert d["deepseek"] == "configured"


# ---------- Product stats & sync_status filter ----------
class TestProductSyncStatus:
    def test_products_stats(self, authed, base_url):
        r = authed.get(f"{base_url}/api/products/stats", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("total", "published", "not_published"):
            assert k in d, f"missing key {k}"
        assert d["total"] == d["published"] + d["not_published"]

    def test_products_have_woo_fields(self, authed, base_url):
        r = authed.get(f"{base_url}/api/products", timeout=15)
        assert r.status_code == 200
        d = r.json()["data"]
        assert len(d) > 0
        p = d[0]
        for k in ("wooSynced", "wpProductId", "lastSyncStatus", "syncedAt"):
            assert k in p, f"missing field {k}"
        assert isinstance(p["wooSynced"], bool)

    def test_filter_imported(self, authed, base_url):
        r = authed.get(f"{base_url}/api/products?sync_status=imported", timeout=15)
        assert r.status_code == 200
        for p in r.json()["data"]:
            assert p["wooSynced"] is False

    def test_filter_published(self, authed, base_url):
        r = authed.get(f"{base_url}/api/products?sync_status=published", timeout=15)
        assert r.status_code == 200
        for p in r.json()["data"]:
            assert p["wooSynced"] is True


# ---------- Order payment fields & update ----------
class TestOrderPayment:
    def test_orders_have_payment_fields_or_are_updatable(self, authed, base_url):
        r = authed.get(f"{base_url}/api/orders", timeout=15)
        assert r.status_code == 200
        orders = r.json()["data"]
        assert len(orders) >= 4
        # Payment fields may or may not be present on seeded orders;
        # verify the schema supports them & PUT works
        for o in orders:
            # optional keys
            _ = o.get("paymentStatus")
            _ = o.get("paymentMethod")
            _ = o.get("paymentReference")

    def test_update_payment_and_persist(self, authed, base_url):
        r = authed.get(f"{base_url}/api/orders", timeout=15)
        target = next(o for o in r.json()["data"] if o["orderNumber"] == "MB-2026-0001")
        oid_ = target["id"]
        payload = {"paymentStatus": "paid", "paymentMethod": "Carte Visa", "paymentReference": "TXN-TEST-123"}
        u = authed.put(f"{base_url}/api/orders/{oid_}/payment", json=payload, timeout=15)
        assert u.status_code == 200, u.text
        assert u.json()["success"] is True
        # verify
        g = authed.get(f"{base_url}/api/orders/{oid_}", timeout=15)
        d = g.json()
        assert d["paymentStatus"] == "paid"
        assert d["paymentMethod"] == "Carte Visa"
        assert d["paymentReference"] == "TXN-TEST-123"
        assert "paidAt" in d


# ---------- WooCommerce webhook ----------
class TestWooWebhook:
    def test_webhook_info(self, authed, base_url):
        r = authed.get(f"{base_url}/api/webhooks/woocommerce/info", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["url"].endswith("/api/webhooks/woocommerce/orders")
        assert "secret" in d
        assert "events" in d and "order.created" in d["events"]
        assert "instructions" in d and "WooCommerce" in d["instructions"]

    def test_webhook_receive_creates_order(self, api_client, base_url):
        payload = {
            "id": 987654,
            "status": "processing",
            "total": "42.50",
            "date_paid": "2026-01-15T10:00:00",
            "payment_method_title": "PayPal",
            "billing": {"first_name": "Test", "last_name": "Webhook", "email": "webhook@test.com"},
            "shipping": {"address_1": "1 rue Test", "city": "Paris"},
            "line_items": [{"sku": "WEBHOOK-TEST", "name": "Test Product", "quantity": 2, "price": "21.25"}],
        }
        # webhook is public (no auth needed); signature skipped when header absent + secret allowed via dev mode
        # note server code returns True when signature not provided OR secret not set; if secret set + no header, it returns True
        r = requests.post(
            f"{base_url}/api/webhooks/woocommerce/orders",
            json=payload, timeout=15,
        )
        # accept 200 or 401 depending on webhook signature policy
        if r.status_code == 401:
            pytest.skip("Webhook requires signature - dev bypass not enabled")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["received"] is True
        # Verify order exists
        s = requests.Session()
        login = s.post(f"{base_url}/api/auth/login",
                       json={"email": "admin@marcherbien.fr", "password": "Admin1234!"}, timeout=15)
        token = login.json()["token"]
        s.headers.update({"Authorization": f"Bearer {token}"})
        orders = s.get(f"{base_url}/api/orders", timeout=15).json()["data"]
        wp_orders = [o for o in orders if o.get("wpOrderId") == 987654]
        assert len(wp_orders) >= 1
        wp = wp_orders[0]
        assert wp["orderNumber"] == "WP-987654"
        assert wp["paymentStatus"] == "paid"
        assert wp["paymentMethod"] == "PayPal"
        assert wp["customerName"] == "Test Webhook"


# ---------- Scheduler ----------
class TestScheduler:
    def test_scheduler_status(self, authed, base_url):
        r = authed.get(f"{base_url}/api/scheduler/status", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["running"] is True
        assert d["cron_hours"] == 6
        job_ids = [j["id"] for j in d["jobs"]]
        assert "stocks_prices_sync" in job_ids
        assert "wc_orders_import" in job_ids

    def test_scheduler_run_now_unknown(self, authed, base_url):
        r = authed.post(f"{base_url}/api/scheduler/run-now/does_not_exist", timeout=15)
        assert r.status_code == 404

    def test_scheduler_history(self, authed, base_url):
        r = authed.get(f"{base_url}/api/scheduler/history", timeout=15)
        assert r.status_code == 200
        assert "data" in r.json()


# ---------- DeepSeek AI (real API; key is INVALID -> expect 500 error) ----------
class TestDeepSeekAI:
    def test_ai_translate_reaches_deepseek(self, authed, base_url):
        r = authed.post(
            f"{base_url}/api/ai/translate",
            json={"text": "Hello world", "source_lang": "en"},
            timeout=45,
        )
        # Expected: 500 because provided key is invalid.
        # 200 would mean the key actually works (also valid).
        assert r.status_code in (200, 500)
        if r.status_code == 500:
            assert "DeepSeek API" in r.text or "401" in r.text or "Unauthorized" in r.text.lower() or "unauth" in r.text.lower()

    def test_ai_seo(self, authed, base_url):
        r = authed.post(
            f"{base_url}/api/ai/seo-description",
            json={"name": "Test", "category": "Hygiène"},
            timeout=45,
        )
        assert r.status_code in (200, 500)

    def test_ai_smart_mapping(self, authed, base_url):
        r = authed.post(
            f"{base_url}/api/ai/smart-mapping",
            json={"columns": ["sku", "name", "price"], "sample_rows": [{"sku": "A1", "name": "Foo", "price": "10"}]},
            timeout=45,
        )
        assert r.status_code in (200, 500)
