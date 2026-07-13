#!/usr/bin/env python3
"""Test script for catalog import with preamble detection (Qogita-style)."""

import sys
sys.path.insert(0, '/app/backend')

from catalog_import import parse_catalog, detect_columns, auto_suggest_mapping

# Read test file
with open('/app/backend/test_qogita.csv', 'rb') as f:
    qogita_csv = f.read()

print("=" * 80)
print("TEST : Détection colonnes Qogita avec préambule")
print("=" * 80)

# Parse
try:
    rows = parse_catalog(qogita_csv, "csv")
    print(f"\n✅ Parsing réussi : {len(rows)} lignes de données extraites")
    
    # Detect columns
    columns = detect_columns(rows)
    print(f"\n📋 Colonnes détectées ({len(columns)}) :")
    for i, col in enumerate(columns, 1):
        print(f"  {i}. {col}")
    
    # Auto-mapping
    mapping = auto_suggest_mapping(columns)
    print(f"\n🎯 Mapping automatique ({len(mapping)} champs mappés) :")
    for internal, source in sorted(mapping.items()):
        print(f"  {internal:15} ← {source}")
    
    # Verify key mappings for Qogita
    print("\n🔍 Vérifications spécifiques Qogita :")
    checks = [
        ("supplierSku", "GTIN", "✅" if mapping.get("supplierSku") == "GTIN" else "❌"),
        ("name", "Name", "✅" if mapping.get("name") == "Name" else "❌"),
        ("costPrice", "EUR Lowest Price inc. shipping", "✅" if mapping.get("costPrice") == "EUR Lowest Price inc. shipping" else "❌"),
        ("stock", "Total Inventory of All Offers", "✅" if mapping.get("stock") == "Total Inventory of All Offers" else "❌"),
        ("leadTimeDays", "Estimated Delivery Time (weeks)", "✅" if mapping.get("leadTimeDays") == "Estimated Delivery Time (weeks)" else "❌"),
        ("packageQty", "Unit", "✅" if mapping.get("packageQty") == "Unit" else "❌"),
    ]
    
    all_ok = True
    for field, expected, status in checks:
        actual = mapping.get(field, "NON MAPPÉ")
        if status == "✅":
            print(f"  {status} {field:15} : {actual}")
        else:
            print(f"  {status} {field:15} : {actual} (attendu: {expected})")
            all_ok = False
    
    # Test first row
    print(f"\n📦 Première ligne brute :")
    if rows:
        first = rows[0]
        for k, v in list(first.items())[:6]:
            print(f"  {k}: {v}")
    
    print("\n" + "=" * 80)
    if all_ok:
        print("✅ SUCCÈS : Tous les mappings Qogita sont corrects !")
    else:
        print("⚠️  ATTENTION : Certains mappings ne correspondent pas aux attentes")
    print("=" * 80)
    
except Exception as e:
    print(f"\n❌ ERREUR : {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
