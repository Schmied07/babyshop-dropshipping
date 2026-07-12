"""Catalog import - parse CSV/Excel/JSON/XML into supplier product rows."""
import io
import json
from typing import List, Dict, Any
import pandas as pd
import xmltodict


def parse_csv(content: bytes) -> List[Dict[str, Any]]:
    df = pd.read_csv(io.BytesIO(content))
    df = df.fillna("")
    return df.to_dict(orient="records")


def parse_excel(content: bytes) -> List[Dict[str, Any]]:
    df = pd.read_excel(io.BytesIO(content))
    df = df.fillna("")
    return df.to_dict(orient="records")


def parse_json(content: bytes) -> List[Dict[str, Any]]:
    data = json.loads(content.decode("utf-8"))
    if isinstance(data, dict):
        # try common wrappers
        for key in ("products", "items", "data", "catalog"):
            if key in data and isinstance(data[key], list):
                return data[key]
        return [data]
    if isinstance(data, list):
        return data
    return []


def parse_xml(content: bytes) -> List[Dict[str, Any]]:
    parsed = xmltodict.parse(content)
    # try to find first list
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
    keys = set()
    for r in rows[:20]:
        keys.update(str(k) for k in r.keys())
    return sorted(keys)


def auto_suggest_mapping(columns: List[str]) -> Dict[str, str]:
    """Suggest mapping of source column -> internal field."""
    fields = {
        "supplierSku": ["sku", "reference", "ref", "code", "product_code", "supplier_sku", "supplierSku"],
        "name": ["name", "nom", "title", "product_name", "designation", "libelle"],
        "costPrice": ["cost", "cost_price", "prix", "price", "prix_ht", "cost_ht", "wholesale", "prix_achat", "costPrice"],
        "stock": ["stock", "qty", "quantity", "quantite", "inventory", "available"],
        "ean": ["ean", "gtin", "barcode"],
        "category": ["category", "categorie", "cat"],
        "brand": ["brand", "marque"],
        "moq": ["moq", "minimum", "min_order", "min_qty"],
        "packageQty": ["package", "pack_qty", "carton", "packaging"],
        "leadTimeDays": ["lead_time", "delai", "delivery"],
    }
    result: Dict[str, str] = {}
    for internal, aliases in fields.items():
        for col in columns:
            norm = str(col).strip().lower().replace(" ", "_").replace("-", "_")
            if any(a in norm for a in aliases):
                result[internal] = col
                break
    return result


def coerce_row(row: Dict[str, Any], mapping: Dict[str, str]) -> Dict[str, Any]:
    """Given a raw row + mapping (internalField -> sourceColumn), return normalized dict."""
    out: Dict[str, Any] = {}
    for internal, src in mapping.items():
        if not src or src not in row:
            continue
        val = row[src]
        if internal in ("costPrice",):
            try:
                out[internal] = float(str(val).replace(",", ".").replace("€", "").strip() or 0)
            except Exception:
                out[internal] = 0
        elif internal in ("stock", "moq", "packageQty", "leadTimeDays"):
            try:
                out[internal] = int(float(str(val).strip() or 0))
            except Exception:
                out[internal] = 0
        else:
            out[internal] = str(val).strip() if val is not None else ""
    return out
