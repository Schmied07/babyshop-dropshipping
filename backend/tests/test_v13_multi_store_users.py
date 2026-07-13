"""EuropaDrop v1.3 tests — docs bugfix, n8n info, multi-store, multi-user."""
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
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_client(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def operator_token(admin_client):
    """Create operator if missing, then log in as operator."""
    r = requests.post(f"{API}/auth/login", json={"email": OPERATOR_EMAIL, "password": OPERATOR_PASSWORD}, timeout=15)
    if r.status_code != 200:
        # Create operator via admin
        cr = admin_client.post(f"{API}/users", json={
            "name": "Operator Test",
            "email": OPERATOR_EMAIL,
            "password": OPERATOR_PASSWORD,
            "role": "operator",
        }, timeout=15)
        assert cr.status_code == 200, f"Operator creation failed: {cr.status_code} {cr.text}"
        r = requests.post(f"{API}/auth/login", json={"email": OPERATOR_EMAIL, "password": OPERATOR_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Operator login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "operator", f"Expected role=operator, got {data['user']['role']}"
    return data["token"]


@pytest.fixture(scope="module")
def operator_client(operator_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {operator_token}", "Content-Type": "application/json"})
    return s


# ---------- Swagger docs bug fix ----------
class TestApiDocs:
    def test_docs_html_200(self):
        r = requests.get(f"{API}/docs", timeout=15)
        assert r.status_code == 200, f"Got {r.status_code}"
        assert "text/html" in r.headers.get("content-type", "").lower()
        assert "swagger" in r.text.lower() or "openapi" in r.text.lower()

    def test_openapi_json_200(self):
        r = requests.get(f"{API}/openapi.json", timeout=15)
        assert r.status_code == 200
        assert "application/json" in r.headers.get("content-type", "").lower()
        data = r.json()
        assert data.get("openapi", "").startswith("3.")
        assert "paths" in data
        # Verify a couple of critical routes are documented
        assert "/api/stores" in data["paths"]
        assert "/api/users" in data["paths"]


# ---------- n8n info ----------
class TestN8nInfo:
    def test_returns_absolute_urls(self, admin_client):
        r = admin_client.get(f"{API}/integrations/n8n/info", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["swagger_docs"].startswith("http"), f"swagger_docs not absolute: {data['swagger_docs']}"
        assert data["swagger_docs"].endswith("/api/docs")
        assert data["openapi_spec"].endswith("/api/openapi.json")
        # The returned swagger URL must be reachable
        docs_reach = requests.get(data["swagger_docs"], timeout=15)
        assert docs_reach.status_code == 200
        spec_reach = requests.get(data["openapi_spec"], timeout=15)
        assert spec_reach.status_code == 200


# ---------- WooCommerce status (v1.3 fields) ----------
class TestWooStatus:
    def test_status_shape(self, admin_client):
        r = admin_client.get(f"{API}/woocommerce/status", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "configured" in data
        assert "stores_count" in data
        # legacy_env_configured only present if configured=True
        if data.get("configured"):
            assert "legacy_env_configured" in data
            assert "reachable" in data


# ---------- Multi-store CRUD ----------
class TestStoresCRUD:
    created_id = None

    def test_list_stores_returns_flag(self, admin_client):
        r = admin_client.get(f"{API}/stores", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "data" in data
        assert "legacy_env_configured" in data
        assert isinstance(data["data"], list)

    def test_create_store_dummy_saves_with_warning(self, admin_client):
        payload = {
            "name": "TEST_Store_Dummy",
            "url": "https://example.invalid-domain-xyz.tld/wp-json/wc/v3",
            "key": "ck_test_dummy_key_1234567890",
            "secret": "cs_test_dummy_secret",
            "isDefault": False,
            "isActive": True,
        }
        r = admin_client.post(f"{API}/stores", json=payload, timeout=30)
        assert r.status_code == 200, f"Create failed: {r.status_code} {r.text}"
        data = r.json()
        assert data["success"] is True
        assert "id" in data
        # Secret must NOT appear in response
        assert "secret" not in data, "Secret leaked in POST response!"
        assert "cs_test_dummy_secret" not in r.text, "Raw secret leaked!"
        TestStoresCRUD.created_id = data["id"]

    def test_list_never_exposes_secret(self, admin_client):
        r = admin_client.get(f"{API}/stores", timeout=15)
        assert r.status_code == 200
        stores = r.json()["data"]
        target = next((s for s in stores if s.get("id") == TestStoresCRUD.created_id), None)
        assert target is not None
        assert "secret" not in target, "Secret exposed in GET!"
        assert "key" not in target, "Full consumer key exposed in GET!"
        assert "keyPreview" in target
        assert target["keyPreview"].endswith("…"), f"keyPreview format wrong: {target['keyPreview']}"
        # raw secret string never present in body
        assert "cs_test_dummy_secret" not in r.text

    def test_update_store(self, admin_client):
        assert TestStoresCRUD.created_id
        r = admin_client.put(
            f"{API}/stores/{TestStoresCRUD.created_id}",
            json={"name": "TEST_Store_Renamed"},
            timeout=15,
        )
        assert r.status_code == 200
        # Verify
        lr = admin_client.get(f"{API}/stores", timeout=15)
        target = next((s for s in lr.json()["data"] if s["id"] == TestStoresCRUD.created_id), None)
        assert target["name"] == "TEST_Store_Renamed"

    def test_store_test_connection_endpoint(self, admin_client):
        assert TestStoresCRUD.created_id
        r = admin_client.post(f"{API}/stores/{TestStoresCRUD.created_id}/test", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "reachable" in data
        # Dummy URL — should be unreachable
        assert data["reachable"] is False

    def test_delete_store(self, admin_client):
        assert TestStoresCRUD.created_id
        r = admin_client.delete(f"{API}/stores/{TestStoresCRUD.created_id}", timeout=15)
        assert r.status_code == 200
        # Verify gone
        lr = admin_client.get(f"{API}/stores", timeout=15)
        ids = [s["id"] for s in lr.json()["data"]]
        assert TestStoresCRUD.created_id not in ids


# ---------- Multi-user management ----------
class TestUsersCRUD:
    created_id = None

    def test_list_users_admin_ok(self, admin_client):
        r = admin_client.get(f"{API}/users", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "data" in data
        assert isinstance(data["data"], list)
        # ensure password_hash is NEVER exposed
        for u in data["data"]:
            assert "password_hash" not in u

    def test_create_operator(self, admin_client):
        r = admin_client.post(f"{API}/users", json={
            "name": "TEST_Op_User",
            "email": "test_op_user@marcherbien.fr",
            "password": "TestOp1234!",
            "role": "operator",
        }, timeout=15)
        # Could 400 if already exists — clean up and retry
        if r.status_code == 400:
            lr = admin_client.get(f"{API}/users", timeout=15).json()["data"]
            existing = next((u for u in lr if u["email"] == "test_op_user@marcherbien.fr"), None)
            if existing:
                admin_client.delete(f"{API}/users/{existing['id']}", timeout=15)
                r = admin_client.post(f"{API}/users", json={
                    "name": "TEST_Op_User",
                    "email": "test_op_user@marcherbien.fr",
                    "password": "TestOp1234!",
                    "role": "operator",
                }, timeout=15)
        assert r.status_code == 200, f"Create failed: {r.status_code} {r.text}"
        TestUsersCRUD.created_id = r.json()["id"]

    def test_invalid_role_rejected(self, admin_client):
        r = admin_client.post(f"{API}/users", json={
            "name": "X", "email": "test_bad_role@marcherbien.fr",
            "password": "X1234!!!", "role": "superadmin",
        }, timeout=15)
        assert r.status_code == 400

    def test_update_user_role_by_admin(self, admin_client):
        assert TestUsersCRUD.created_id
        r = admin_client.put(f"{API}/users/{TestUsersCRUD.created_id}", json={"name": "TEST_Op_Renamed"}, timeout=15)
        assert r.status_code == 200

    def test_admin_cannot_delete_self(self, admin_client):
        me = admin_client.get(f"{API}/auth/me", timeout=15).json()
        r = admin_client.delete(f"{API}/users/{me['id']}", timeout=15)
        assert r.status_code == 400, "Admin should not be able to delete self"

    def test_delete_test_user(self, admin_client):
        if TestUsersCRUD.created_id:
            r = admin_client.delete(f"{API}/users/{TestUsersCRUD.created_id}", timeout=15)
            assert r.status_code == 200


# ---------- Operator RBAC ----------
class TestOperatorRBAC:
    def test_operator_login_returns_role(self, operator_token):
        # Token exists → already asserted role=operator in fixture
        assert operator_token

    def test_operator_cannot_list_users(self, operator_client):
        r = operator_client.get(f"{API}/users", timeout=15)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"

    def test_operator_cannot_create_users(self, operator_client):
        r = operator_client.post(f"{API}/users", json={
            "name": "hack", "email": "hack@x.com", "password": "P1234!!!", "role": "admin",
        }, timeout=15)
        assert r.status_code == 403

    def test_operator_can_read_products(self, operator_client):
        # Operator should still have read access to products (regular auth, not admin-gated)
        r = operator_client.get(f"{API}/products?limit=1", timeout=15)
        assert r.status_code == 200

    def test_operator_cannot_change_own_role(self, operator_client):
        me = operator_client.get(f"{API}/auth/me", timeout=15).json()
        r = operator_client.put(f"{API}/users/{me['id']}", json={"role": "admin"}, timeout=15)
        # Should succeed (200) but role update should be stripped server-side
        assert r.status_code == 200
        after = operator_client.get(f"{API}/auth/me", timeout=15).json()
        assert after["role"] == "operator", f"Operator escalated to {after['role']}!"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
