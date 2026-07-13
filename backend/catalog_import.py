"""Catalog import - parse CSV/Excel/JSON/XML into supplier product rows.

Robust to real-world supplier catalogs that:
  * Start with 1-N rows of preamble / disclaimer / branding before the real header row
  * Use varied column names across suppliers (Qogita, VidaXL, BigBuy, Ankorstore, ...)
  * Mix EN / FR / ES / IT headers
"""
import io
import json
import re
from typing import List, Dict, Any, Optional, Tuple

import pandas as pd
import xmltodict


# ---------- Header row auto-detection ----------
def _norm(s: Any) -> str:
    """Aggressive normalization for header/alias comparison."""
    if s is None:
        return ""
    txt = str(s).strip().lower()
    txt = txt.replace("€", "eur").replace("$", "usd").replace("£", "gbp")
    # collapse everything non-alphanumeric into single underscore
    txt = re.sub(r"[^a-z0-9]+", "_", txt).strip("_")
    return txt


def _looks_like_header_cell(val: Any) -> bool:
    """A header cell is a short, non-empty string that is NOT a sentence/paragraph."""
    if val is None:
        return False
    s = str(val).strip()
    if not s or s.lower() == "nan":
        return False
    if len(s) > 80:  # sentences / disclaimers
        return False
    # too many words → likely a sentence
    if len(s.split()) > 8:
        return False
    return True


def _find_header_row(raw: pd.DataFrame, max_scan: int = 25) -> int:
    """Return the row index that most likely contains column headers.

    Strategy: score each of the first N rows by
      + number of distinct header-shaped cells
      + bonus if the following row has similar or greater non-null density
    """
    n = min(max_scan, len(raw))
    best_idx, best_score = 0, -1
    for i in range(n):
        row = raw.iloc[i].tolist()
        header_cells = [str(v).strip() for v in row if _looks_like_header_cell(v)]
        if len(header_cells) < 2:
            continue
        distinct = len(set(header_cells))
        # bonus for follow-up data density
        next_bonus = 0
        for j in range(i + 1, min(i + 4, len(raw))):
            next_vals = [v for v in raw.iloc[j].tolist() if pd.notna(v) and str(v).strip()]
            if len(next_vals) >= max(2, distinct // 2):
                next_bonus += 3
        score = distinct * 2 + next_bonus
        if score > best_score:
            best_score = score
            best_idx = i
    return best_idx if best_score > 0 else 0


def _dataframe_from_bytes(content: bytes, kind: str) -> pd.DataFrame:
    """Read Excel/CSV with no header assumption, then auto-detect the real header row."""
    if kind == "xlsx":
        raw = pd.read_excel(io.BytesIO(content), header=None, dtype=object)
    else:
        # Try utf-8 first, fall back to latin-1; auto-detect delimiter.
        try:
            raw = pd.read_csv(io.BytesIO(content), header=None, dtype=object, sep=None, engine="python")
        except UnicodeDecodeError:
            raw = pd.read_csv(io.BytesIO(content), header=None, dtype=object, sep=None,
                              engine="python", encoding="latin-1")

    if raw.empty:
        return pd.DataFrame()

    header_idx = _find_header_row(raw)
    header_row = raw.iloc[header_idx].tolist()

    # Build clean column names; deduplicate + fill blanks
    seen: Dict[str, int] = {}
    columns: List[str] = []
    for i, v in enumerate(header_row):
        if pd.isna(v) or str(v).strip() == "":
            base = f"col_{i}"
        else:
            base = str(v).strip()
        # dedupe
        if base in seen:
            seen[base] += 1
            base = f"{base}_{seen[base]}"
        else:
            seen[base] = 0
        columns.append(base)

    body = raw.iloc[header_idx + 1:].copy()
    body.columns = columns
    body = body.dropna(how="all")
    body = body.fillna("")
    return body


# ---------- Format parsers ----------
def parse_csv(content: bytes) -> List[Dict[str, Any]]:
    return _dataframe_from_bytes(content, "csv").to_dict(orient="records")


def parse_excel(content: bytes) -> List[Dict[str, Any]]:
    return _dataframe_from_bytes(content, "xlsx").to_dict(orient="records")


def parse_json(content: bytes) -> List[Dict[str, Any]]:
    data = json.loads(content.decode("utf-8"))
    if isinstance(data, dict):
        for key in ("products", "items", "data", "catalog"):
            if key in data and isinstance(data[key], list):
                return data[key]
        return [data]
    if isinstance(data, list):
        return data
    return []


def parse_xml(content: bytes) -> List[Dict[str, Any]]:
    parsed = xmltodict.parse(content)

    def find_list(node):
        if isinstance(node, list):
            return node
        if isinstance(node, dict):
            for v in node.values():
                r = find_list(v)
                if r is not None:
                    return r
        return None

    lst = find_list(parsed)
    return lst or []


def parse_catalog(content: bytes, fmt: str) -> List[Dict[str, Any]]:
    fmt = fmt.lower()
    if fmt == "csv":
        return parse_csv(content)
    if fmt in ("xlsx", "xls", "excel"):
        return parse_excel(content)
    if fmt == "json":
        return parse_json(content)
    if fmt == "xml":
        return parse_xml(content)
    raise ValueError(f"Format non supporté: {fmt}")


def detect_columns(rows: List[Dict[str, Any]]) -> List[str]:
    if not rows:
        return []
    keys: List[str] = []
    seen: set = set()
    # Preserve original column order from the first row (dict preserves insertion order in py3.7+)
    for r in rows[:20]:
        for k in r.keys():
            sk = str(k)
            if sk not in seen:
                seen.add(sk)
                keys.append(sk)
    return keys


# ---------- Auto-mapping (multi-supplier aware) ----------
# Aliases are matched against a normalized version of the source column (lower + underscore).
# Order = specificity: earlier aliases win if multiple would match.
_FIELD_ALIASES: List[Tuple[str, List[str]]] = [
    ("supplierSku", [
        "supplier_sku", "supplier_reference", "reference_fournisseur",
        "sku", "reference", "ref", "product_code", "code_produit", "code_article",
        "article_code", "article", "id_produit", "product_id",
        "code",  # last resort
    ]),
    ("name", [
        "product_name", "designation", "libelle", "libelle_produit", "product_title",
        "title", "nom_produit", "nom", "name",
    ]),
    ("costPrice", [
        "cost_price", "cost_ht", "prix_achat", "prix_achat_ht", "wholesale_price",
        "wholesale", "purchase_price", "buying_price", "buy_price",
        "lowest_price_inc_shipping", "eur_lowest_price_inc_shipping",
        "lowest_price", "lowest_priced_offer",
        "prix_ht", "prix_fournisseur", "prix", "tarif", "price", "unit_price",
    ]),
    ("stock", [
        "total_inventory_of_all_offers", "total_inventory", "total_stock",
        "stock_quantity", "quantity_available", "available_stock", "available_qty",
        "lowest_priced_offer_inventory",
        "stock", "inventory", "quantite", "quantity", "qty", "available", "dispo",
    ]),
    ("ean", [
        "gtin", "ean13", "ean_13", "ean", "upc", "barcode", "code_barre",
    ]),
    ("category", [
        "category", "categorie", "cat", "categorie_produit", "category_name",
        "department", "rayon", "famille", "sous_categorie",
    ]),
    ("brand", [
        "brand_name", "brand", "marque", "manufacturer", "fabricant",
    ]),
    ("moq", [
        "moq", "min_order", "min_order_qty", "minimum_order_quantity", "minimum_order",
        "min_qty", "minimum", "quantite_minimum",
    ]),
    ("packageQty", [
        "package_qty", "pack_qty", "carton_qty", "units_per_pack", "package_size",
        "packaging", "carton", "pack", "unit",  # Qogita: "Unit" is units-per-offer
    ]),
    ("leadTimeDays", [
        "estimated_delivery_time_weeks", "estimated_delivery_time",
        "estimated_delivery", "delivery_time", "delivery_delay", "lead_time",
        "delai_livraison", "delai", "delivery",
    ]),
]

# Fields that must NOT be auto-mapped from the same source column
_EXCLUSIVE_TARGETS = {"supplierSku", "name", "costPrice", "stock", "ean",
                      "category", "brand", "moq", "packageQty", "leadTimeDays"}


def _alias_matches(alias_norm: str, col_norm: str) -> bool:
    if not alias_norm or not col_norm:
        return False
    if alias_norm == col_norm:
        return True
    # boundary-aware substring (avoid matching "sku" inside "riskuous")
    return (
        col_norm.startswith(alias_norm + "_")
        or col_norm.endswith("_" + alias_norm)
        or f"_{alias_norm}_" in f"_{col_norm}_"
    )


def auto_suggest_mapping(columns: List[str]) -> Dict[str, str]:
    """Return {internalField: sourceColumn} with per-field alias-priority matching."""
    normalized: List[Tuple[str, str]] = [(c, _norm(c)) for c in columns]
    result: Dict[str, str] = {}
    used: set = set()

    for internal, aliases in _FIELD_ALIASES:
        best_col: Optional[str] = None
        best_rank = 10**9
        for rank, alias in enumerate(aliases):
            na = _norm(alias)
            for col, ncol in normalized:
                if col in used:
                    continue
                if _alias_matches(na, ncol):
                    if rank < best_rank:
                        best_col = col
                        best_rank = rank
                    break  # move on to next alias
            if best_rank == 0:
                break  # perfect alias, stop searching
        if best_col is not None:
            result[internal] = best_col
            used.add(best_col)

    # Fallback: if we could not find a proper SKU column, reuse EAN/GTIN as SKU
    if "supplierSku" not in result and "ean" in result:
        result["supplierSku"] = result["ean"]

    return result


# ---------- Row normalization ----------
_NUM_RE = re.compile(r"-?\d+(?:[.,]\d+)?")


def _parse_number(val: Any) -> float:
    if val is None or val == "":
        return 0.0
    s = str(val).strip()
    if not s:
        return 0.0
    # remove currency symbols and thousand separators
    s = s.replace("€", "").replace("$", "").replace("£", "").replace(" ", "")
    # If both , and . appear, assume , is thousands separator
    if "," in s and "." in s:
        s = s.replace(",", "")
    else:
        s = s.replace(",", ".")
    m = _NUM_RE.search(s)
    if not m:
        return 0.0
    try:
        return float(m.group(0).replace(",", "."))
    except ValueError:
        return 0.0


def coerce_row(row: Dict[str, Any], mapping: Dict[str, str]) -> Dict[str, Any]:
    """Given a raw row + mapping (internalField -> sourceColumn), return normalized dict."""
    out: Dict[str, Any] = {}
    for internal, src in mapping.items():
        if not src or src not in row:
            continue
        val = row[src]
        if internal == "costPrice":
            out[internal] = _parse_number(val)
        elif internal in ("stock", "moq", "packageQty", "leadTimeDays"):
            out[internal] = int(_parse_number(val))
        else:
            out[internal] = str(val).strip() if val is not None else ""
    return out
