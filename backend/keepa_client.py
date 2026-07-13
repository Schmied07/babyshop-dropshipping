"""Keepa API client wrapper for Amazon price tracking.

Provides async interface to Keepa API with automatic caching and token management.
"""
import os
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import asyncio

try:
    import keepa
except ImportError:
    keepa = None


# Keepa domain mapping for EU Amazon marketplaces
KEEPA_DOMAINS = {
    "amazon.fr": 3,   # France
    "amazon.de": 2,   # Germany (Allemagne)
    "amazon.es": 8,   # Spain (Espagne)
    "amazon.it": 7,   # Italy (Italie)
    "amazon.nl": 4,   # Netherlands (Pays-Bas)
    "amazon.be": 3,   # Belgium (Belgique) - shares with FR
    "amazon.pl": 9,   # Poland (Pologne)
    "amazon.se": 10,  # Sweden (Suède)
    "amazon.uk": 1,   # United Kingdom (Royaume-Uni)
}

# Runtime API key (set by app settings or env)
_runtime_keepa_key: Optional[str] = None


def set_keepa_api_key(key: Optional[str]) -> None:
    """Set runtime Keepa API key (from admin/global settings)."""
    global _runtime_keepa_key
    _runtime_keepa_key = (key or "").strip() or None


def current_keepa_key() -> str:
    """Get global/admin fallback Keepa key."""
    return _runtime_keepa_key or os.environ.get("KEEPA_API_KEY", "")


def resolve_keepa_key(explicit: Optional[str] = None) -> str:
    """Return effective Keepa key: explicit -> runtime -> env."""
    if explicit and str(explicit).strip():
        return str(explicit).strip()
    return current_keepa_key()


def is_keepa_configured(explicit: Optional[str] = None) -> bool:
    """Check if Keepa API is configured."""
    return bool(resolve_keepa_key(explicit))


async def get_keepa_client(api_key: Optional[str] = None):
    """Get or create async Keepa client instance."""
    if keepa is None:
        raise RuntimeError("keepa package not installed. Install with: pip install keepa")
    
    key = resolve_keepa_key(api_key)
    if not key:
        raise RuntimeError("Keepa API key not configured")
    
    # Create async client
    client = await keepa.AsyncKeepa.create(key)
    return client


async def query_product_by_asin(
    asin: str,
    marketplace: str,
    api_key: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Query Keepa for product data by ASIN.
    
    Returns normalized product data with current prices, stats, etc.
    """
    domain = KEEPA_DOMAINS.get(marketplace)
    if domain is None:
        raise ValueError(f"Unsupported marketplace: {marketplace}")
    
    client = await get_keepa_client(api_key)
    
    try:
        # Query with stats for current prices and sales rank
        products = await client.query(
            asin,
            history=False,  # Don't fetch full history (saves tokens)
            stats=90,       # Get last 90 days stats
            offers=20,      # Get up to 20 current offers
            domain=domain,
            wait=False,     # Don't wait for tokens (fail fast if exhausted)
        )
        
        if not products or len(products) == 0:
            return None
        
        product = products[0]
        
        # Extract current stats
        stats = getattr(product, "stats", None)
        current = getattr(stats, "current", {}) if stats else {}
        
        # Normalize data
        data = {
            "asin": asin,
            "marketplace": marketplace,
            "domain": domain,
            "title": getattr(product, "title", None),
            "brand": getattr(product, "brand", None),
            "manufacturer": getattr(product, "manufacturer", None),
            "amazon_price": getattr(current, "AMAZON", None) if hasattr(current, "AMAZON") else current.get("AMAZON"),
            "buybox_price": getattr(current, "BUY_BOX", None) if hasattr(current, "BUY_BOX") else current.get("BUY_BOX"),
            "sales_rank": getattr(current, "SALES", None) if hasattr(current, "SALES") else current.get("SALES"),
            "offer_count": getattr(stats, "offerCount", 0) if stats else 0,
            "currency": "EUR",  # Most EU markets use EUR
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
        
        # Get image URL if available
        images = getattr(product, "imagesCSV", None)
        if images:
            image_list = images.split(",") if isinstance(images, str) else []
            data["image_url"] = image_list[0] if image_list else None
        
        return data
        
    except Exception as e:
        # Log error but don't crash
        print(f"Keepa query error for ASIN {asin}: {e}")
        return None


async def batch_query_products(
    asins: List[str],
    marketplace: str,
    api_key: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Query multiple ASINs in parallel (with rate limiting)."""
    if not asins:
        return []
    
    # Keepa recommends batching but we'll do sequential with small delay
    # to avoid token exhaustion
    results = []
    for asin in asins:
        try:
            data = await query_product_by_asin(asin, marketplace, api_key)
            if data:
                results.append(data)
            # Small delay between requests to avoid rate limits
            await asyncio.sleep(0.5)
        except Exception as e:
            print(f"Error querying ASIN {asin}: {e}")
            continue
    
    return results
