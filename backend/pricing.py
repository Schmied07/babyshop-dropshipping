"""Pricing rules engine + supplier auto-selection."""
from typing import List, Optional
from models import PricingRule, SupplierProduct


def apply_rounding(price: float, rule: str) -> float:
    if rule == "ends_99":
        # round up to next .99
        return float(int(price)) + 0.99 if price - int(price) > 0 else price - 0.01 + 0.99
    if rule == "ends_00":
        return float(round(price))
    if rule == "nearest_10":
        return float(round(price / 10) * 10) - 0.01
    return round(price, 2)


def compute_retail_price(cost: float, rule: Optional[PricingRule]) -> float:
    if not rule:
        # default: ×3, ends .99
        return apply_rounding(cost * 3, "ends_99")
    price = cost * (1 + rule.markupPercent / 100)
    if rule.minMargin and price - cost < rule.minMargin:
        price = cost + rule.minMargin
    return apply_rounding(price, rule.roundingRule)


def find_best_rule(rules: List[PricingRule], category: Optional[str], supplierId: Optional[str]) -> Optional[PricingRule]:
    candidates = [r for r in rules if r.isActive]
    # more specific first: category+supplier > category > supplier > global
    def score(r: PricingRule):
        s = 0
        if r.category == category:
            s += 10
        elif r.category:
            s -= 5
        if r.supplierId == supplierId:
            s += 5
        elif r.supplierId:
            s -= 3
        s += r.priority
        return s
    if not candidates:
        return None
    return sorted(candidates, key=score, reverse=True)[0]


def auto_select_supplier(supplier_products: List[SupplierProduct], strategy: str = "cheapest") -> Optional[SupplierProduct]:
    """Select best supplier: cheapest | fastest | most_stock | balanced."""
    available = [sp for sp in supplier_products if sp.available and sp.stock > 0]
    if not available:
        available = [sp for sp in supplier_products if sp.available]
    if not available:
        return None

    if strategy == "cheapest":
        return sorted(available, key=lambda s: (s.costPrice, -s.priority))[0]
    if strategy == "fastest":
        return sorted(available, key=lambda s: (s.leadTime.max, s.costPrice))[0]
    if strategy == "most_stock":
        return sorted(available, key=lambda s: (-s.stock, s.costPrice))[0]
    # balanced: normalized score
    max_cost = max(s.costPrice for s in available) or 1
    max_lead = max(s.leadTime.max for s in available) or 1
    max_stock = max(s.stock for s in available) or 1

    def bscore(s: SupplierProduct):
        return (
            (s.costPrice / max_cost) * 0.5
            + (s.leadTime.max / max_lead) * 0.3
            - (s.stock / max_stock) * 0.2
            - s.priority * 0.05
        )
    return sorted(available, key=bscore)[0]
