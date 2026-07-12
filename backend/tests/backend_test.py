"""Backend integration tests for MarcherBien Dropship API."""
import io
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or None


# ---------- Health ----------
class TestHealth:
    def test_health_ok(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/health", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "ok"
        assert d["mongodb"] == "connected"
        assert d["woocommerce"] == "configured"


# ---------- Auth ----------
class TestAuth:
    def test_login_success(self, base_url):
        r = requests.post(
            f"{base_url}/api/auth/login",
            json={"email": "admin@marcherbien.fr", "password": "Admin1234!"},
            timeout=15,
        )
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and isinstance(d["token"], str) and len(d["token"]) > 10
        assert d["user"]["email"] == "admin@marcherbien.fr"
        assert d["user"]["role"] == "admin"

    def test_login_wrong_password(self, base_url):
        r = requests.post(
            f"{base_url}/api/auth/login",
            json={"email": "admin@marcherbien.fr", "password": "wrong"},
            timeout=15,
        )
        assert r.status_code == 401

    def test_me(self, authed, base_url):
        r = authed.get(f"{base_url}/api/auth/me", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == "admin@marcherbien.fr"

    def test_me_no_token(self, base_url):
        r = requests.get(f"{base_url}/api/auth/me", timeout=15)
        assert r.status_code in (401, 403)


# ---------- Suppliers ----------
class TestSuppliers:
    def test_list(self, authed, base_url):
        r = authed.get(f"{base_url}/api/suppliers", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["success"] is True
        assert d["count"] >= 4
        names = [s["name"] for s in d["data"]]
        assert any("Santé Bébé" in n for n in names)
        assert any("Bébé Distribution" in n for n in names)
        assert any("Pedibaby" in n for n in names)
        assert any("Piccolini" in n for n in names)

    def test_crud(self, authed, base_url):
        payload = {
            "name": "TEST_Supplier_QA",
            "country": "France",
            "email": "test@qa.local",
            "isActive": True,
            "rating": 4.0,
        }
        r = authed.post(f"{base_url}/api/suppliers", json=payload, timeout=15)
        assert r.status_code == 200
        sid = r.json()["id"]
        # GET
        g = authed.get(f"{base_url}/api/suppliers/{sid}", timeout=15)
        assert g.status_code == 200
        assert g.json()["name"] == "TEST_Supplier_QA"
        # PUT
        u = authed.put(f"{base_url}/api/suppliers/{sid}", json={"name": "TEST_Supplier_QA2"}, timeout=15)
        assert u.status_code == 200
        assert u.json()["name"] == "TEST_Supplier_QA2"
        # DELETE
        d = authed.delete(f"{base_url}/api/suppliers/{sid}", timeout=15)
        assert d.status_code == 200


# ---------- Products & multi-supplier ----------
class TestProducts:
    def test_list_products(self, authed, base_url):
        r = authed.get(f"{base_url}/api/products", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["success"] is True
        assert d["pagination"]["total"] >= 10
        assert len(d["data"]) >= 10

    def test_filter_by_category(self, authed, base_url):
        r = authed.get(f"{base_url}/api/products?category=Hygi%C3%A8ne", timeout=15)
        assert r.status_code == 200
        for p in r.json()["data"]:
            assert p["category"] == "Hygiène"

    def test_search_q(self, authed, base_url):
        r = authed.get(f"{base_url}/api/products?q=serum", timeout=15)
        assert r.status_code == 200
        assert r.json()["pagination"]["total"] >= 1

    def test_get_product_detail_with_suppliers(self, authed, base_url):
        r = authed.get(f"{base_url}/api/products?q=SERUM-0001", timeout=15)
        pid = r.json()["data"][0]["id"]
        r2 = authed.get(f"{base_url}/api/products/{pid}", timeout=15)
        assert r2.status_code == 200
        d = r2.json()
        assert d["product"]["sku"] == "HYG-SERUM-0001"
        assert len(d["suppliers"]) == 3
        for sp in d["suppliers"]:
            assert sp["supplierNameFull"]


# ---------- Supplier products / auto-select ----------
class TestSupplierProducts:
    def test_list(self, authed, base_url):
        r = authed.get(f"{base_url}/api/supplier-products", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["count"] >= 14

    def test_best_supplier_strategies(self, authed, base_url):
        # Find serum product
        r = authed.get(f"{base_url}/api/products?q=SERUM-0001", timeout=15)
        pid = r.json()["data"][0]["id"]

        # cheapest -> Pedibaby (0.38)
        r1 = authed.get(f"{base_url}/api/products/{pid}/best-supplier?strategy=cheapest", timeout=15)
        assert r1.status_code == 200
        b = r1.json()["best"]
        assert b is not None
        assert abs(b["costPrice"] - 0.38) < 0.01
        assert "Pedibaby" in b["supplierNameFull"]

        # fastest -> Bébé Distribution (lead 2-4)
        r2 = authed.get(f"{base_url}/api/products/{pid}/best-supplier?strategy=fastest", timeout=15)
        assert r2.status_code == 200
        b2 = r2.json()["best"]
        assert "Bébé Distribution" in b2["supplierNameFull"]

        # most_stock -> Santé Bébé (500)
        r3 = authed.get(f"{base_url}/api/products/{pid}/best-supplier?strategy=most_stock", timeout=15)
        assert r3.status_code == 200
        b3 = r3.json()["best"]
        assert b3["stock"] == 500
        assert "Santé Bébé" in b3["supplierNameFull"]


# ---------- Pricing rules ----------
class TestPricingRules:
    def test_list_and_default(self, authed, base_url):
        r = authed.get(f"{base_url}/api/pricing-rules", timeout=15)
        assert r.status_code == 200
        d = r.json()["data"]
        assert any(rule["name"] == "Marge standard x3" for rule in d)

    def test_crud_and_apply_all(self, authed, base_url):
        payload = {"name": "TEST_rule", "markupPercent": 150, "roundingRule": "ends_99", "priority": 5, "isActive": True}
        r = authed.post(f"{base_url}/api/pricing-rules", json=payload, timeout=15)
        assert r.status_code == 200
        rid = r.json()["id"]
        # update
        u = authed.put(f"{base_url}/api/pricing-rules/{rid}", json={"markupPercent": 175}, timeout=15)
        assert u.status_code == 200
        assert u.json()["markupPercent"] == 175
        # apply-all
        ap = authed.post(f"{base_url}/api/pricing-rules/apply-all", timeout=60)
        assert ap.status_code == 200
        assert ap.json()["updated"] >= 10
        # cleanup
        authed.delete(f"{base_url}/api/pricing-rules/{rid}", timeout=15)


# ---------- Catalog import ----------
class TestCatalogImport:
    def test_preview_and_import(self, authed, base_url):
        csv = "sku,name,price,stock\nTEST-QA-001,Produit Test QA,2.50,100\nTEST-QA-002,Autre produit,5.00,50\n"
        files = {"file": ("t.csv", io.BytesIO(csv.encode()), "text/csv")}
        # preview needs auth via headers, requests session accepts files but must remove content-type
        h = {k: v for k, v in authed.headers.items() if k.lower() != "content-type"}
        r = requests.post(f"{base_url}/api/catalog/preview", files=files, headers=h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["format"] == "csv"
        assert d["total_rows"] == 2
        assert "sku" in d["columns"]
        assert d["suggested_mapping"].get("supplierSku") == "sku" or d["suggested_mapping"].get("name") == "name"

        # Fetch supplier
        sups = authed.get(f"{base_url}/api/suppliers", timeout=15).json()["data"]
        sup_id = sups[0]["id"]

        import json
        files = {"file": ("t.csv", io.BytesIO(csv.encode()), "text/csv")}
        data = {"supplierId": sup_id, "mapping": json.dumps(d["suggested_mapping"])}
        r2 = requests.post(f"{base_url}/api/catalog/import-file", files=files, data=data, headers=h, timeout=60)
        assert r2.status_code == 200, r2.text
        j = r2.json()
        assert j["success"] is True
        assert (j["imported"] + j["updated"]) >= 1

        # history
        h_r = authed.get(f"{base_url}/api/catalog/history", timeout=15)
        assert h_r.status_code == 200
        assert len(h_r.json()["data"]) >= 1


# ---------- Orders ----------
class TestOrders:
    def test_list(self, authed, base_url):
        r = authed.get(f"{base_url}/api/orders", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["count"] >= 4
        nums = [o["orderNumber"] for o in d["data"]]
        assert "MB-2026-0001" in nums

    def test_filter_status(self, authed, base_url):
        r = authed.get(f"{base_url}/api/orders?status=shipped", timeout=15)
        assert r.status_code == 200
        for o in r.json()["data"]:
            assert o["status"] == "shipped"

    def test_bulk_fulfill_and_tracking(self, authed, base_url):
        # find a pending order
        r = authed.get(f"{base_url}/api/orders?status=pending", timeout=15)
        pending = r.json()["data"]
        assert len(pending) >= 1
        oid_ = pending[0]["id"]
        # bulk-fulfill
        r2 = authed.post(
            f"{base_url}/api/orders/bulk-fulfill",
            json={"orderIds": [oid_], "strategy": "cheapest"},
            timeout=30,
        )
        assert r2.status_code == 200
        assert r2.json()["success"] is True
        # verify updated
        g = authed.get(f"{base_url}/api/orders/{oid_}", timeout=15)
        assert g.status_code == 200
        assert g.json()["status"] == "processing"
        # supplierId assigned
        assert any(it.get("supplierId") for it in g.json()["items"])
        # tracking
        r3 = authed.post(
            f"{base_url}/api/orders/{oid_}/tracking",
            json={"trackingNumber": "TESTTRACK123", "trackingCarrier": "Colissimo"},
            timeout=15,
        )
        assert r3.status_code == 200
        g2 = authed.get(f"{base_url}/api/orders/{oid_}", timeout=15)
        assert g2.json()["status"] == "shipped"
        assert g2.json()["trackingNumber"] == "TESTTRACK123"


# ---------- WooCommerce ----------
class TestWooCommerce:
    def test_status(self, authed, base_url):
        r = authed.get(f"{base_url}/api/woocommerce/status", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["configured"] is True

    def test_sync_product(self, authed, base_url):
        pr = authed.get(f"{base_url}/api/products", timeout=15).json()["data"]
        pid = pr[0]["id"]
        r = authed.post(f"{base_url}/api/woocommerce/sync-product/{pid}", timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert "success" in d


# ---------- Notifications ----------
class TestNotifications:
    def test_list(self, authed, base_url):
        r = authed.get(f"{base_url}/api/notifications", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "unread" in d
        assert isinstance(d["data"], list)

    def test_mark_read_and_all(self, authed, base_url):
        r = authed.get(f"{base_url}/api/notifications", timeout=15).json()
        if r["data"]:
            nid = r["data"][0]["id"]
            m = authed.put(f"{base_url}/api/notifications/{nid}/read", timeout=15)
            assert m.status_code == 200
        m2 = authed.post(f"{base_url}/api/notifications/mark-all-read", timeout=15)
        assert m2.status_code == 200


# ---------- Dashboard ----------
class TestDashboard:
    def test_overview(self, authed, base_url):
        r = authed.get(f"{base_url}/api/dashboard/overview", timeout=30)
        assert r.status_code == 200
        d = r.json()
        m = d["metrics"]
        for k in ["revenue", "margin", "marginPercent", "lowStockCount", "totalProducts", "totalSuppliers", "pendingOrders"]:
            assert k in m
        assert m["totalProducts"] >= 10
        assert m["totalSuppliers"] >= 4
        assert isinstance(d["topProducts"], list)
        assert isinstance(d["revenueSeries"], list)
        assert isinstance(d["lowStockItems"], list)

    def test_supplier_performance(self, authed, base_url):
        r = authed.get(f"{base_url}/api/dashboard/supplier-performance", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert len(d["data"]) >= 4
        for s in d["data"]:
            for k in ["supplierId", "name", "country", "products", "avgLeadTime", "totalStock", "avgCost"]:
                assert k in s
