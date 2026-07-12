"""WooCommerce REST client (WC v3) — supports multiple stores via credentials param."""
import os
import base64
from typing import Optional, Dict
import httpx


def _default_creds() -> Optional[dict]:
    """Fallback: single-store legacy env credentials."""
    url = os.environ.get("WP_API_URL", "").rstrip("/")
    key = os.environ.get("WP_API_KEY", "")
    secret = os.environ.get("WP_API_SECRET", "")
    if url and key and secret:
        return {"url": url, "key": key, "secret": secret, "name": "default"}
    return None


def make_auth_header(creds: dict) -> dict:
    token = base64.b64encode(f"{creds['key']}:{creds['secret']}".encode()).decode()
    return {"Authorization": f"Basic {token}", "Content-Type": "application/json"}


async def wc_get(path: str, params: Optional[dict] = None, creds: Optional[dict] = None) -> httpx.Response:
    c = creds or _default_creds()
    if not c:
        raise RuntimeError("No WooCommerce credentials")
    async with httpx.AsyncClient(timeout=30) as client:
        return await client.get(f"{c['url']}{path}", headers=make_auth_header(c), params=params or {})


async def wc_post(path: str, data: dict, creds: Optional[dict] = None) -> httpx.Response:
    c = creds or _default_creds()
    if not c:
        raise RuntimeError("No WooCommerce credentials")
    async with httpx.AsyncClient(timeout=30) as client:
        return await client.post(f"{c['url']}{path}", headers=make_auth_header(c), json=data)


async def wc_put(path: str, data: dict, creds: Optional[dict] = None) -> httpx.Response:
    c = creds or _default_creds()
    if not c:
        raise RuntimeError("No WooCommerce credentials")
    async with httpx.AsyncClient(timeout=30) as client:
        return await client.put(f"{c['url']}{path}", headers=make_auth_header(c), json=data)


def is_configured() -> bool:
    return _default_creds() is not None


async def test_connection(creds: dict) -> dict:
    """Test if credentials work by calling /products?per_page=1."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{creds['url']}/products",
                headers=make_auth_header(creds),
                params={"per_page": 1},
            )
        return {
            "reachable": r.status_code < 400,
            "status_code": r.status_code,
            "error": None if r.status_code < 400 else r.text[:200],
        }
    except Exception as e:
        return {"reachable": False, "status_code": 0, "error": str(e)}
