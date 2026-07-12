"""WooCommerce REST client (WC v3)."""
import os
import base64
from typing import Optional
import httpx

WP_API_URL = os.environ.get("WP_API_URL", "").rstrip("/")
WP_API_KEY = os.environ.get("WP_API_KEY", "")
WP_API_SECRET = os.environ.get("WP_API_SECRET", "")


def _auth_header() -> dict:
    token = base64.b64encode(f"{WP_API_KEY}:{WP_API_SECRET}".encode()).decode()
    return {"Authorization": f"Basic {token}", "Content-Type": "application/json"}


async def wc_get(path: str, params: Optional[dict] = None) -> httpx.Response:
    async with httpx.AsyncClient(timeout=30) as client:
        return await client.get(f"{WP_API_URL}{path}", headers=_auth_header(), params=params or {})


async def wc_post(path: str, data: dict) -> httpx.Response:
    async with httpx.AsyncClient(timeout=30) as client:
        return await client.post(f"{WP_API_URL}{path}", headers=_auth_header(), json=data)


async def wc_put(path: str, data: dict) -> httpx.Response:
    async with httpx.AsyncClient(timeout=30) as client:
        return await client.put(f"{WP_API_URL}{path}", headers=_auth_header(), json=data)


def is_configured() -> bool:
    return bool(WP_API_URL and WP_API_KEY and WP_API_SECRET)
