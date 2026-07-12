"""EuropaDrop v1.2 features: webhook secret regeneration, API keys with scopes,
outbound webhooks (n8n), integrations info."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


# ---------- Webhook secret regeneration ----------
def test_webhook_regenerate_secret_persists(authed):
    r = authed.post(f"{BASE_URL}/api/webhooks/woocommerce/regenerate-secret")
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert data["secret"] and len(data["secret"]) >= 32
    new_secret = data["secret"]

    # Verify GET info returns the new secret (from DB, not env)
    r2 = authed.get(f"{BASE_URL}/api/webhooks/woocommerce/info")
    assert r2.status_code == 200
    assert r2.json()["secret"] == new_secret


def test_webhook_regenerate_changes_secret():
    # Use a fresh authed client
    s = requests.Session()
    lr = s.post(f"{BASE_URL}/api/auth/login",
                json={"email": "admin@marcherbien.fr", "password": "Admin1234!"}, timeout=30)
    assert lr.status_code == 200
    s.headers.update({"Authorization": f"Bearer {lr.json()['token']}"})

    a = s.post(f"{BASE_URL}/api/webhooks/woocommerce/regenerate-secret").json()["secret"]
    b = s.post(f"{BASE_URL}/api/webhooks/woocommerce/regenerate-secret").json()["secret"]
    assert a != b


# ---------- API Keys - scopes discovery ----------
def test_api_keys_scopes_endpoint(authed):
    r = authed.get(f"{BASE_URL}/api/api-keys/scopes")
    assert r.status_code == 200
    data = r.json()
    assert "scopes" in data
    scopes = data["scopes"]
    # Must have at least 22 scopes
    assert len(scopes) >= 22
    # sanity: known scopes present
    for s in ["*", "products.read", "products.write", "orders.write", "ai.translate", "webhooks.manage"]:
        assert s in scopes


# ---------- API Keys - CRUD ----------
def test_create_list_apikey(authed):
    payload = {"name": "TEST_KEY_readonly", "scopes": ["products.read"], "description": "unit test"}
    r = authed.post(f"{BASE_URL}/api/api-keys", json=payload)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["success"] is True
    assert d["key"].startswith("ed_")
    assert "warning" in d
    assert d["scopes"] == ["products.read"]
    kid = d["id"]

    # List should show it (prefix only, no raw key)
    lr = authed.get(f"{BASE_URL}/api/api-keys")
    assert lr.status_code == 200
    items = lr.json()["data"]
    found = [k for k in items if k["id"] == kid]
    assert found and found[0]["name"] == "TEST_KEY_readonly"
    assert found[0].get("keyPrefix", "").startswith("ed_")
    assert "key" not in found[0]  # raw key never returned in list

    # Cleanup
    authed.delete(f"{BASE_URL}/api/api-keys/{kid}")


def test_create_apikey_invalid_scope(authed):
    r = authed.post(f"{BASE_URL}/api/api-keys",
                    json={"name": "TEST_BAD", "scopes": ["not.a.real.scope"]})
    assert r.status_code == 400


# ---------- API Keys - Scope enforcement ----------
@pytest.fixture(scope="module")
def readonly_key():
    s = requests.Session()
    lr = s.post(f"{BASE_URL}/api/auth/login",
                json={"email": "admin@marcherbien.fr", "password": "Admin1234!"}, timeout=30)
    s.headers.update({"Authorization": f"Bearer {lr.json()['token']}",
                      "Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/api-keys",
               json={"name": "TEST_KEY_ro_scope", "scopes": ["products.read"]}).json()
    yield {"raw": r["key"], "id": r["id"]}
    s.delete(f"{BASE_URL}/api/api-keys/{r['id']}")


@pytest.fixture(scope="module")
def full_key():
    s = requests.Session()
    lr = s.post(f"{BASE_URL}/api/auth/login",
                json={"email": "admin@marcherbien.fr", "password": "Admin1234!"}, timeout=30)
    s.headers.update({"Authorization": f"Bearer {lr.json()['token']}",
                      "Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/api-keys",
               json={"name": "TEST_KEY_full", "scopes": ["*"]}).json()
    yield {"raw": r["key"], "id": r["id"]}
    s.delete(f"{BASE_URL}/api/api-keys/{r['id']}")


def test_readonly_key_allows_products_read(readonly_key):
    r = requests.get(f"{BASE_URL}/api/products",
                     headers={"Authorization": f"Bearer {readonly_key['raw']}"})
    assert r.status_code == 200
    assert "data" in r.json()


def test_readonly_key_denies_suppliers_write(readonly_key):
    r = requests.post(
        f"{BASE_URL}/api/suppliers",
        headers={"Authorization": f"Bearer {readonly_key['raw']}",
                 "Content-Type": "application/json"},
        json={"name": "TEST_x", "country": "FR"},
    )
    assert r.status_code == 403
    assert "suppliers.write" in r.json().get("detail", "")


def test_readonly_key_denies_orders_read(readonly_key):
    r = requests.get(f"{BASE_URL}/api/orders",
                     headers={"Authorization": f"Bearer {readonly_key['raw']}"})
    assert r.status_code == 403
    assert "orders.read" in r.json().get("detail", "")


def test_full_key_allows_all(full_key):
    r = requests.get(f"{BASE_URL}/api/orders",
                     headers={"Authorization": f"Bearer {full_key['raw']}"})
    assert r.status_code == 200
    r2 = requests.get(f"{BASE_URL}/api/suppliers",
                      headers={"Authorization": f"Bearer {full_key['raw']}"})
    assert r2.status_code == 200


# ---------- API key revocation ----------
def test_revoke_key_returns_401(authed):
    r = authed.post(f"{BASE_URL}/api/api-keys",
                    json={"name": "TEST_KEY_revoke", "scopes": ["*"]}).json()
    raw = r["key"]
    kid = r["id"]

    # works before revoke
    ok = requests.get(f"{BASE_URL}/api/products",
                      headers={"Authorization": f"Bearer {raw}"})
    assert ok.status_code == 200

    # revoke
    rv = authed.post(f"{BASE_URL}/api/api-keys/{kid}/revoke")
    assert rv.status_code == 200

    # now unauthorized
    bad = requests.get(f"{BASE_URL}/api/products",
                       headers={"Authorization": f"Bearer {raw}"})
    assert bad.status_code == 401
    assert "révoquée" in bad.json().get("detail", "").lower() or "invalide" in bad.json().get("detail", "").lower()

    authed.delete(f"{BASE_URL}/api/api-keys/{kid}")


# ---------- Outbound webhooks ----------
def test_outbound_list_returns_events(authed):
    r = authed.get(f"{BASE_URL}/api/outbound-webhooks")
    assert r.status_code == 200
    data = r.json()
    assert "data" in data
    assert "available_events" in data
    events = data["available_events"]
    for e in ["order.created", "order.shipped", "order.paid", "low_stock"]:
        assert e in events


def test_outbound_crud_and_test(authed):
    # Use httpbin as a real mock endpoint
    r = authed.post(f"{BASE_URL}/api/outbound-webhooks", json={
        "name": "TEST_webhook_httpbin",
        "url": "https://httpbin.org/post",
        "events": ["order.created", "order.shipped", "low_stock"],
    })
    assert r.status_code == 200, r.text
    w = r.json()
    wid = w["id"]
    assert w["secret"]  # auto-generated
    assert w["deliveryCount"] == 0

    # Test endpoint (should ping httpbin.org)
    t = authed.post(f"{BASE_URL}/api/outbound-webhooks/{wid}/test")
    assert t.status_code == 200
    tdata = t.json()
    # httpbin should respond 200
    assert tdata.get("status_code") in (200, None)  # may be None if network fails

    # Cleanup
    authed.delete(f"{BASE_URL}/api/outbound-webhooks/{wid}")


def test_outbound_invalid_event(authed):
    r = authed.post(f"{BASE_URL}/api/outbound-webhooks", json={
        "name": "TEST_bad", "url": "https://example.com", "events": ["bogus.event"],
    })
    assert r.status_code == 400


def test_outbound_dispatched_on_order_shipped(authed):
    """Create an outbound webhook subscribed to order.shipped, then POST tracking
    on an order and verify deliveryCount increments."""
    # create subscriber
    w = authed.post(f"{BASE_URL}/api/outbound-webhooks", json={
        "name": "TEST_dispatch_ship",
        "url": "https://httpbin.org/post",
        "events": ["order.shipped"],
    }).json()
    wid = w["id"]

    # create a fresh order
    o = authed.post(f"{BASE_URL}/api/orders", json={
        "customerName": "TEST_dispatch",
        "customerEmail": "test@test.local",
        "items": [{"productId": "", "sku": "TEST-SKU", "name": "x",
                   "quantity": 1, "price": 10.0, "supplierCost": 5.0}],
        "total": 10.0,
        "status": "processing",
    }).json()
    oid = o["id"]

    # trigger tracking
    tr = authed.post(f"{BASE_URL}/api/orders/{oid}/tracking",
                     json={"trackingNumber": "TEST123", "trackingCarrier": "DHL"})
    assert tr.status_code == 200

    # Wait briefly for async dispatch
    import time
    time.sleep(3)

    # Fetch webhook and check counter
    listed = authed.get(f"{BASE_URL}/api/outbound-webhooks").json()["data"]
    entry = [x for x in listed if x["id"] == wid][0]
    assert entry["deliveryCount"] >= 1, f"Expected deliveryCount>=1, got {entry}"

    # cleanup
    authed.delete(f"{BASE_URL}/api/outbound-webhooks/{wid}")
    authed.delete(f"{BASE_URL}/api/orders/{oid}") if False else None  # no DELETE endpoint; leave


# ---------- n8n info endpoint ----------
def test_n8n_info(authed):
    r = authed.get(f"{BASE_URL}/api/integrations/n8n/info")
    assert r.status_code == 200
    d = r.json()
    for k in ["swagger_docs", "openapi_spec", "auth_method", "example_curl", "steps"]:
        assert k in d
    assert len(d["steps"]) == 5
    assert "/docs" in d["swagger_docs"]
    assert "/openapi.json" in d["openapi_spec"]


# ---------- FastAPI docs endpoints ----------
def test_openapi_json_accessible():
    r = requests.get(f"{BASE_URL}/openapi.json", timeout=15)
    assert r.status_code == 200
    spec = r.json()
    assert spec.get("openapi", "").startswith("3.")
    assert "paths" in spec
    # Our new endpoints must be documented
    assert "/api/api-keys" in spec["paths"]
    assert "/api/outbound-webhooks" in spec["paths"]


def test_docs_page_accessible():
    r = requests.get(f"{BASE_URL}/docs", timeout=15)
    assert r.status_code == 200
    assert "swagger" in r.text.lower() or "openapi" in r.text.lower()
