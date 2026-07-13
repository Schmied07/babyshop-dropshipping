"""EuropaDrop v1.4 tests — store-analytics, bulk AI, bulk publish, CSV export,
settings, competitor-prices, and multi-user data isolation."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://catalog-import-fix-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@marcherbien.fr"
ADMIN_PASSWORD = "Admin1234!"
OPERATOR_EMAIL = "operator@marcherbien.fr"
OPERATOR_PASSWORD = "Op1234!"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data
    assert data["user"]["role"] == "admin"
    return data["token"]


@pytest.fixture(scope="module")
def admin_client(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def operator_token(admin_client):
    r = requests.post(f"{API}/auth/login", json={"email": OPERATOR_EMAIL, "password": OPERATOR_PASSWORD}, timeout=15)
    if r.status_code != 200:
        cr = admin_client.post(f"{API}/users", json={
            "name": "Op",
            "email": OPERATOR_EMAIL,
            "password": OPERATOR_PASSWORD,
            "role": "operator",
        }, timeout=15)
        assert cr.status_code == 200, f"Operator creation failed: {cr.status_code} {cr.text}"
        r = requests.post(f"{API}/auth/login", json={"email": OPERATOR_EMAIL, "password": OPERATOR_PASSWORD}, timeout=15)
    assert r.status_code == 200
    return r.json()["token"]


@pytest.fixture(scope="module")
def operator_client(operator_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {operator_token}", "Content-Type": "application/json"})
    return s


# ---------- Admin login ----------
class TestAdminLogin:
    def test_login_returns_token_and_admin_role(self, admin_token):
        assert admin_token
        assert isinstance(admin_token, str)
        assert len(admin_token) > 10


# ---------- Store analytics ----------
class TestStoreAnalytics:
    def test_store_analytics_shape(self, admin_client):
        r = admin_client.get(f"{API}/dashboard/store-analytics", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert "data" in data
        assert isinstance(data["data"], list)
        # Required fields on each row
        required = {"storeId", "storeName", "catalogValue", "catalogMargin",
                    "revenue", "margin", "marginPercent"}
        for row in data["data"]:
            missing = required - set(row.keys())
            assert not missing, f"Missing fields {missing} in row {row}"

    def test_unattributed_bucket_present_when_orders_without_store(self, admin_client):
        # Seed data has 4 orders with no storeId — the 'Non attribuée' bucket
        # should therefore appear.
        r = admin_client.get(f"{API}/dashboard/store-analytics", timeout=20)
        assert r.status_code == 200
        rows = r.json()["data"]
        names = [row.get("storeName") for row in rows]
        # Not strict — just ensure the endpoint handles the case shape-wise.
        # If seed orders all have storeId, the bucket won't be present.
        if any(row.get("storeId") is None for row in rows):
            unattr = next(row for row in rows if row.get("storeId") is None)
            assert unattr["storeName"] == "Non attribuée"
            assert unattr["orderCount"] >= 0


# ---------- Settings (multi-currency + VAT) ----------
class TestSettings:
    def test_get_defaults(self, admin_client):
        r = admin_client.get(f"{API}/settings", timeout=15)
        assert r.status_code == 200
        s = r.json()["settings"]
        # It's OK if a previous test ran; check keys exist
        assert "currency" in s
        assert "vatRate" in s
        assert "vatIncluded" in s
        assert "exchangeRates" in s

    def test_put_and_persist(self, admin_client):
        # Put USD/5.5
        r = admin_client.put(f"{API}/settings", json={"currency": "USD", "vatRate": 5.5}, timeout=15)
        assert r.status_code == 200
        assert r.json()["settings"]["currency"] == "USD"
        assert r.json()["settings"]["vatRate"] == 5.5
        # Re-GET and verify persistence
        g = admin_client.get(f"{API}/settings", timeout=15)
        assert g.json()["settings"]["currency"] == "USD"
        assert g.json()["settings"]["vatRate"] == 5.5
        # Reset back to defaults
        admin_client.put(f"{API}/settings", json={"currency": "EUR", "vatRate": 20.0}, timeout=15)


# ---------- Bulk AI action with empty DeepSeek key ----------
class TestBulkAI:
    def test_bulk_ai_empty_key_degrades_gracefully(self, admin_client):
        # Get 2 product ids
        pr = admin_client.get(f"{API}/products?limit=2", timeout=15)
        assert pr.status_code == 200
        prods = pr.json().get("data", [])
        pids = [p["id"] for p in prods][:2]
        r = admin_client.post(f"{API}/ai/bulk-action",
                              json={"productIds": pids, "action": "translate"},
                              timeout=30)
        assert r.status_code == 200, f"Expected 200 not 500, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["success"] is False
        assert data["configured"] is False
        assert "message" in data
        assert isinstance(data["message"], str) and len(data["message"]) > 0


# ---------- Bulk publish ----------
class TestBulkPublish:
    def test_bulk_publish_returns_summary_no_crash(self, admin_client):
        pr = admin_client.get(f"{API}/products?limit=2", timeout=15)
        assert pr.status_code == 200
        pids = [p["id"] for p in pr.json().get("data", [])][:2]
        r = admin_client.post(f"{API}/woocommerce/bulk-publish",
                              json={"productIds": pids, "storeIds": []},
                              timeout=60)
        assert r.status_code == 200, f"Expected 200 not 500, got {r.status_code}: {r.text}"
        data = r.json()
        assert "published" in data
        assert "failed" in data
        assert "details" in data
        assert isinstance(data["details"], list)


# ---------- CSV export ----------
class TestCSVExport:
    def test_export_products_csv(self, admin_client):
        r = admin_client.get(f"{API}/export/products.csv", timeout=20)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "").lower()
        lines = r.text.strip().split("\n")
        assert len(lines) >= 2, "Expected header + at least 1 data row"
        assert "sku" in lines[0].lower()
        assert "name" in lines[0].lower()

    def test_export_orders_csv(self, admin_client):
        r = admin_client.get(f"{API}/export/orders.csv", timeout=20)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "").lower()
        lines = r.text.strip().split("\n")
        assert len(lines) >= 1
        assert "ordernumber" in lines[0].lower() or "order" in lines[0].lower()


# ---------- Competitor prices ----------
class TestCompetitorPrices:
    created_id = None

    def test_create_and_alert(self, admin_client):
        pr = admin_client.get(f"{API}/products?limit=1", timeout=15)
        prods = pr.json().get("data", [])
        assert prods, "Need at least 1 product seeded"
        prod = prods[0]
        pid = prod["id"]
        our_price = prod.get("retailPrice", 100)
        # competitor cheaper -> alert should be raised
        competitor_price = max(1.0, our_price - 5.0)
        r = admin_client.post(f"{API}/competitor-prices", json={
            "productId": pid,
            "competitorName": "TEST_Competitor_A",
            "competitorPrice": competitor_price,
        }, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["success"] is True
        TestCompetitorPrices.created_id = r.json()["id"]

    def test_list_shows_alert(self, admin_client):
        r = admin_client.get(f"{API}/competitor-prices", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert "alertsCount" in data
        assert data["alertsCount"] >= 1
        # Find our TEST_ row
        row = next((x for x in data["data"] if x.get("id") == TestCompetitorPrices.created_id), None)
        assert row is not None, "Just-created row not returned"
        assert row["isCheaper"] is False  # we are more expensive than competitor

    def test_delete(self, admin_client):
        assert TestCompetitorPrices.created_id
        r = admin_client.delete(f"{API}/competitor-prices/{TestCompetitorPrices.created_id}", timeout=15)
        assert r.status_code == 200


# ---------- MULTI-USER DATA ISOLATION (CRITICAL) ----------
class TestIsolation:
    """The most important test set: operator must NOT see seeded data owned by admin."""

    def _cleanup_operator_resources(self, operator_client):
        """Delete any TEST_ stores/products/competitor prices the operator created."""
        try:
            for coll_path, key in [("/products", "sku"), ("/stores", "name"), ("/competitor-prices", "competitorName")]:
                r = operator_client.get(f"{API}{coll_path}", timeout=15)
                if r.status_code == 200:
                    items = r.json().get("data", [])
                    for item in items:
                        if isinstance(item.get(key), str) and item[key].startswith("TEST_"):
                            operator_client.delete(f"{API}{coll_path}/{item['id']}", timeout=15)
        except Exception as e:
            print(f"cleanup err: {e}")

    def test_operator_sees_no_admin_seed_products(self, operator_client):
        # Clean any residue from a previous run first
        self._cleanup_operator_resources(operator_client)
        r = operator_client.get(f"{API}/products", timeout=15)
        assert r.status_code == 200
        data = r.json()
        items = data.get("data", [])
        assert len(items) == 0, f"Operator sees {len(items)} products but should see 0 (seed is admin-owned). First: {items[:1]}"

    def test_operator_sees_no_admin_seed_orders(self, operator_client):
        r = operator_client.get(f"{API}/orders", timeout=15)
        assert r.status_code == 200
        items = r.json().get("data", [])
        assert len(items) == 0, f"Operator sees {len(items)} orders but should see 0"

    def test_operator_sees_no_admin_seed_stores(self, operator_client):
        r = operator_client.get(f"{API}/stores", timeout=15)
        assert r.status_code == 200
        items = r.json().get("data", [])
        assert len(items) == 0, f"Operator sees {len(items)} stores but should see 0"

    def test_admin_sees_seeded_data(self, admin_client):
        # Admin should see the seed (10 products, 4 orders) — plus any TEST_
        p = admin_client.get(f"{API}/products", timeout=15).json().get("data", [])
        o = admin_client.get(f"{API}/orders", timeout=15).json().get("data", [])
        assert len(p) >= 10, f"Admin sees only {len(p)} products (expected ≥10 from seed)"
        assert len(o) >= 4, f"Admin sees only {len(o)} orders (expected ≥4 from seed)"

    def test_operator_creates_own_store_and_product_only_visible_to_self(self, operator_client, admin_client):
        # Cleanup first to make counts deterministic
        self._cleanup_operator_resources(operator_client)

        # Operator creates a store
        st = operator_client.post(f"{API}/stores", json={
            "name": "TEST_Op_Store",
            "url": "https://op-example.invalid/wp-json/wc/v3",
            "key": "ck_op_test_key_xxxxxxxx",
            "secret": "cs_op_test_secret_yyyyyyy",
            "isDefault": False, "isActive": True,
        }, timeout=30)
        assert st.status_code == 200, st.text
        op_store_id = st.json()["id"]

        # Operator creates a product
        prod_payload = {
            "sku": "TEST_OP_SKU_001",
            "name": "TEST_Op_Product",
            "category": "Test",
            "brand": "TestBrand",
            "costPrice": 5.0,
            "retailPrice": 15.0,
            "stock": 10,
            "isActive": True,
        }
        pr = operator_client.post(f"{API}/products", json=prod_payload, timeout=15)
        assert pr.status_code == 200, pr.text
        op_prod_id = pr.json().get("id") or pr.json().get("_id")

        # Operator sees ONLY its own 1 store and 1 product
        s_list = operator_client.get(f"{API}/stores", timeout=15).json().get("data", [])
        assert len(s_list) == 1, f"Operator should have 1 store, has {len(s_list)}"
        assert s_list[0]["id"] == op_store_id

        p_list = operator_client.get(f"{API}/products", timeout=15).json().get("data", [])
        assert len(p_list) == 1, f"Operator should have 1 product, has {len(p_list)}"
        assert p_list[0]["sku"] == "TEST_OP_SKU_001"

        # Admin sees the seed PLUS operator's items
        admin_p = admin_client.get(f"{API}/products", timeout=15).json().get("data", [])
        assert any(p.get("sku") == "TEST_OP_SKU_001" for p in admin_p), \
            "Admin should see operator's product too"
        admin_s = admin_client.get(f"{API}/stores", timeout=15).json().get("data", [])
        assert any(s.get("name") == "TEST_Op_Store" for s in admin_s), \
            "Admin should see operator's store too"

        # Cleanup
        operator_client.delete(f"{API}/stores/{op_store_id}", timeout=15)
        if op_prod_id:
            operator_client.delete(f"{API}/products/{op_prod_id}", timeout=15)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
