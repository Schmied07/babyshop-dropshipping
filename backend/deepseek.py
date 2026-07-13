"""DeepSeek client (OpenAI-compatible API).

Supports two levels of key resolution:
  1. Explicit ``api_key`` argument passed to each helper (per-user key, from DB).
  2. Global fallback: runtime key set via ``set_api_key`` (from admin/global settings),
     otherwise ``DEEPSEEK_API_KEY`` from the environment.
"""
import os
import json
import re
from typing import List, Optional, Dict, Any
import httpx

DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")

# Runtime key set from app settings (admin/global) takes priority over the .env value.
_runtime_key: Optional[str] = None


def set_api_key(key: Optional[str]) -> None:
    global _runtime_key
    _runtime_key = (key or "").strip() or None


def current_key() -> str:
    """Global/admin fallback key."""
    return _runtime_key or DEEPSEEK_API_KEY


def resolve_key(explicit: Optional[str] = None) -> str:
    """Return the effective key for this call: explicit -> runtime -> env."""
    if explicit and str(explicit).strip():
        return str(explicit).strip()
    return current_key()


def is_configured(explicit: Optional[str] = None) -> bool:
    return bool(resolve_key(explicit))


async def chat(
    messages: List[Dict[str, str]],
    model: str = "deepseek-chat",
    temperature: float = 0.3,
    max_tokens: int = 1024,
    response_format: Optional[Dict[str, Any]] = None,
    api_key: Optional[str] = None,
) -> str:
    key = resolve_key(api_key)
    if not key:
        raise RuntimeError("DEEPSEEK_API_KEY manquant")
    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if response_format:
        payload["response_format"] = response_format
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{DEEPSEEK_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if r.status_code >= 400:
            raise RuntimeError(f"DeepSeek API {r.status_code}: {r.text[:200]}")
        data = r.json()
        return data["choices"][0]["message"]["content"]


async def translate_to_french(text: str, source_lang: str = "auto", api_key: Optional[str] = None) -> str:
    """Translate any EN/ES/IT text to French."""
    if not text or not text.strip():
        return text
    prompt = (
        f"Traduis fidèlement le texte suivant en français professionnel. "
        f"Garde le sens exact, le ton commercial, et les mots-clés produit. "
        f"Renvoie UNIQUEMENT la traduction, sans commentaire ni guillemets.\n\n"
        f"Texte ({source_lang}):\n{text}"
    )
    return (await chat(
        [{"role": "user", "content": prompt}],
        temperature=0.2, max_tokens=800, api_key=api_key,
    )).strip()


async def generate_seo_description(
    product_name: str, category: str = "", brand: str = "", features: str = "",
    api_key: Optional[str] = None,
) -> Dict[str, str]:
    """Generate SEO title + meta description + long description for a product."""
    prompt = (
        f"Tu es un expert SEO e-commerce français spécialisé produits bébé/puériculture.\n"
        f"Génère pour ce produit :\n"
        f"- Nom: {product_name}\n"
        f"- Catégorie: {category or 'inconnue'}\n"
        f"- Marque: {brand or 'inconnue'}\n"
        f"- Caractéristiques: {features or 'aucune'}\n\n"
        f"Renvoie STRICTEMENT un JSON valide avec ces clés (français uniquement) :\n"
        f'{{"seo_title": "titre 60 caractères max avec mots-clés",'
        f' "meta_description": "meta 155 caractères max, appel à l\'action",'
        f' "description": "description longue 3 paragraphes HTML avec balises <p>, mise en avant bénéfices bébé/parents",'
        f' "keywords": ["mot-clé1", "mot-clé2", "mot-clé3", "mot-clé4", "mot-clé5"]}}'
    )
    raw = await chat(
        [{"role": "user", "content": prompt}],
        temperature=0.6, max_tokens=1200,
        response_format={"type": "json_object"},
        api_key=api_key,
    )
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                pass
        return {"seo_title": product_name, "meta_description": "", "description": raw, "keywords": []}


async def normalize_categories(
    source_categories: List[str], existing_categories: List[str], api_key: Optional[str] = None,
) -> Dict[str, str]:
    """Map each supplier category to the closest existing user category (or keep it if none fits)."""
    if not source_categories:
        return {}
    prompt = (
        f"Tu organises un catalogue e-commerce.\n"
        f"Catégories existantes de la boutique: {json.dumps(existing_categories, ensure_ascii=False)}\n"
        f"Catégories du fournisseur à normaliser: {json.dumps(source_categories, ensure_ascii=False)}\n\n"
        f"Pour CHAQUE catégorie fournisseur, choisis la catégorie existante la plus proche. "
        f"Si aucune ne correspond, propose un nom de catégorie propre (français, titre court). "
        f"Renvoie STRICTEMENT un JSON objet: {{\"categorie_fournisseur\": \"categorie_cible\", ...}}"
    )
    raw = await chat(
        [{"role": "user", "content": prompt}],
        temperature=0.1, max_tokens=800,
        response_format={"type": "json_object"},
        api_key=api_key,
    )
    try:
        data = json.loads(raw)
        return {str(k): str(v) for k, v in data.items() if v}
    except json.JSONDecodeError:
        return {c: c for c in source_categories}


async def smart_column_mapping(
    columns: List[str], sample_rows: List[Dict[str, Any]], api_key: Optional[str] = None,
) -> Dict[str, str]:
    """Suggest intelligent mapping using DeepSeek."""
    internal_fields = {
        "supplierSku": "SKU / référence fournisseur du produit",
        "name": "nom / désignation / titre du produit",
        "costPrice": "prix d'achat HT (€)",
        "stock": "quantité en stock disponible",
        "category": "catégorie du produit",
        "brand": "marque du produit",
        "ean": "code EAN/GTIN/barcode",
        "moq": "quantité minimum de commande",
        "packageQty": "quantité par carton/pack",
        "leadTimeDays": "délai de livraison en jours",
    }
    prompt = (
        f"Tu es un expert e-commerce. Voici les colonnes d'un catalogue fournisseur:\n"
        f"COLONNES: {json.dumps(columns, ensure_ascii=False)}\n\n"
        f"Échantillon (3 lignes): {json.dumps(sample_rows[:3], ensure_ascii=False, default=str)}\n\n"
        f"Pour chacun de ces champs internes, choisis la MEILLEURE colonne source (ou null si absente):\n"
        f"{json.dumps(internal_fields, ensure_ascii=False, indent=2)}\n\n"
        f"Renvoie STRICTEMENT un JSON: {{\"supplierSku\": \"colonne_choisie\" ou null, ...}}"
    )
    raw = await chat(
        [{"role": "user", "content": prompt}],
        temperature=0.1, max_tokens=600,
        response_format={"type": "json_object"},
        api_key=api_key,
    )
    try:
        data = json.loads(raw)
        return {k: v for k, v in data.items() if v and v in columns}
    except json.JSONDecodeError:
        return {}
