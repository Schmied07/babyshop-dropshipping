# Guide de Mapping EAN → ASIN pour Keepa

## 📋 Pourquoi ce mapping est nécessaire

L'API Keepa utilise les **ASINs Amazon** comme identifiants produits, mais les catalogues fournisseurs utilisent des **EANs/GTINs**. Il faut donc créer un mapping pour convertir EAN → ASIN par marketplace.

---

## 🗄️ Structure de la collection MongoDB

**Collection :** `ean_asin_mapping`

**Structure d'un document :**
```javascript
{
  "ean": "1234567890123",           // EAN/GTIN du produit
  "marketplace": "amazon.fr",        // Marketplace Amazon
  "asin": "B08XYZ123",              // ASIN Amazon correspondant
  "verified": true,                  // Mapping vérifié ?
  "added_at": ISODate("2025-01-15"), // Date d'ajout
  "source": "manual"                 // Source : manual, api, catalog
}
```

**Index recommandés :**
```javascript
db.ean_asin_mapping.createIndex({ ean: 1, marketplace: 1 }, { unique: true })
db.ean_asin_mapping.createIndex({ asin: 1 })
```

---

## 🔧 Méthodes pour peupler le mapping

### Méthode 1 : Import manuel CSV

**1. Préparer un fichier CSV**
```csv
ean,marketplace,asin
1234567890123,amazon.fr,B08XYZ123
1234567890123,amazon.de,B08ABC456
9876543210987,amazon.fr,B07DEF789
```

**2. Script d'import Python**
```python
import csv
from pymongo import MongoClient
from datetime import datetime

client = MongoClient("mongodb://localhost:27017")
db = client["dropshipping"]

with open("ean_asin_mapping.csv", "r") as f:
    reader = csv.DictReader(f)
    for row in reader:
        db.ean_asin_mapping.update_one(
            {"ean": row["ean"], "marketplace": row["marketplace"]},
            {
                "$set": {
                    "ean": row["ean"],
                    "marketplace": row["marketplace"],
                    "asin": row["asin"],
                    "verified": True,
                    "added_at": datetime.utcnow(),
                    "source": "manual"
                }
            },
            upsert=True
        )

print("Import terminé !")
```

**3. Exécuter**
```bash
cd /app/backend
python import_ean_asin.py
```

---

### Méthode 2 : Extraction depuis catalogues fournisseurs

Si tes catalogues contiennent déjà les ASINs dans une colonne, tu peux les extraire automatiquement.

**Script d'extraction :**
```python
import pandas as pd
from pymongo import MongoClient
from datetime import datetime

client = MongoClient("mongodb://localhost:27017")
db = client["dropshipping"]

# Charger le catalogue
df = pd.read_csv("catalogue_qogita.csv")

# Colonnes : EAN, ASIN, Marketplace (ou déduire le marketplace)
for _, row in df.iterrows():
    if pd.notna(row["EAN"]) and pd.notna(row["ASIN"]):
        db.ean_asin_mapping.update_one(
            {"ean": str(row["EAN"]), "marketplace": "amazon.fr"},
            {
                "$set": {
                    "ean": str(row["EAN"]),
                    "marketplace": "amazon.fr",
                    "asin": str(row["ASIN"]),
                    "verified": False,  # À vérifier manuellement
                    "added_at": datetime.utcnow(),
                    "source": "catalog"
                }
            },
            upsert=True
        )

print("Extraction terminée !")
```

---

### Méthode 3 : Amazon Product Advertising API (PA-API)

**Résolution dynamique EAN → ASIN** via l'API officielle Amazon.

**Avantages :**
- Automatique
- Toujours à jour
- Support multi-marketplace

**Inconvénients :**
- Nécessite compte Amazon Associés
- Quotas API (limité)
- Plus complexe

**Exemple de requête PA-API** (SearchItems avec EAN) :
```python
from paapi5_python_sdk.api.default_api import DefaultApi
from paapi5_python_sdk.search_items_request import SearchItemsRequest
from paapi5_python_sdk.search_items_resource import SearchItemsResource

def resolve_ean_to_asin(ean, marketplace="amazon.fr"):
    """
    Résout un EAN en ASIN via Amazon PA-API.
    """
    # Configuration PA-API (à compléter)
    api = DefaultApi(
        access_key="YOUR_ACCESS_KEY",
        secret_key="YOUR_SECRET_KEY",
        host="webservices.amazon.fr",  # Selon marketplace
        region="eu-west-1"
    )
    
    # Recherche par EAN
    request = SearchItemsRequest(
        partner_tag="YOUR_PARTNER_TAG",
        partner_type="Associates",
        keywords=ean,
        search_index="All",
        resources=[
            SearchItemsResource.ITEM_INFO_EXTERNAL_IDS,
            SearchItemsResource.OFFERS_LISTINGS_PRICE
        ]
    )
    
    response = api.search_items(request)
    
    if response.search_result and response.search_result.items:
        for item in response.search_result.items:
            # Vérifier que l'EAN correspond
            if hasattr(item.item_info, "external_ids"):
                if ean in item.item_info.external_ids.ea_ns.display_values:
                    return item.asin
    
    return None
```

**Intégration dans le backend :**
- Endpoint `/api/keepa/resolve-ean` qui appelle PA-API
- Cache le résultat dans `ean_asin_mapping`
- Utilise le cache en priorité

---

### Méthode 4 : Scraping (non recommandé)

Possible mais contre les TOS Amazon. Risque de ban IP.

---

## 🎯 Stratégie recommandée

**Phase 1 : Démarrage rapide**
1. Extraire EAN + ASIN depuis tes catalogues fournisseurs (si disponibles)
2. Importer manuellement les 50-100 produits principaux via CSV

**Phase 2 : Automatisation**
1. Intégrer Amazon PA-API pour résolution dynamique
2. Cacher tous les résultats dans `ean_asin_mapping`
3. Fallback sur PA-API uniquement si mapping absent

**Phase 3 : Maintenance**
1. Script hebdomadaire pour vérifier les ASINs
2. Alertes si produit non trouvé sur Amazon
3. Mise à jour automatique des mappings obsolètes

---

## 🧪 Vérifier le mapping

**Via MongoDB shell :**
```javascript
// Compter les mappings
db.ean_asin_mapping.countDocuments()

// Voir un exemple
db.ean_asin_mapping.findOne()

// Mappings par marketplace
db.ean_asin_mapping.aggregate([
  { $group: { _id: "$marketplace", count: { $sum: 1 } } }
])

// Trouver mapping pour un EAN
db.ean_asin_mapping.findOne({ ean: "1234567890123", marketplace: "amazon.fr" })
```

**Via l'application :**
- Page "Comparaison Amazon"
- Sélectionner un fournisseur
- Si produits non comparés → mapping manquant

---

## 📊 Exemple de dataset minimal

Pour tester Keepa, voici un dataset minimal avec des produits Amazon populaires :

```csv
ean,marketplace,asin
0194252031391,amazon.fr,B09JQMJHXY
0194253715146,amazon.fr,B0BSHF7WHW
8806094968927,amazon.fr,B0C2T3JQRH
```

**Produits testés :**
- Apple AirPods Pro 2
- Apple iPhone 14 Pro
- Samsung Galaxy S23

---

## ⚠️ Notes importantes

1. **Un EAN peut avoir différents ASINs selon le marketplace**
   - EAN `123` → ASIN `B08XYZ` sur amazon.fr
   - EAN `123` → ASIN `B08ABC` sur amazon.de

2. **Tous les produits n'ont pas d'équivalent Amazon**
   - Produits de niche
   - Marques exclusives fournisseurs
   - Nouveautés non encore listées

3. **ASINs peuvent changer**
   - Amazon peut fusionner des listings
   - Produits retirés du catalogue
   - Mise à jour périodique recommandée

4. **Confidentialité**
   - Les mappings EAN→ASIN sont considérés comme propriété intellectuelle
   - Ne pas partager publiquement tes mappings complets

---

## 🚀 Quick Start (pour tester)

**1. Créer un fichier de test**
```bash
cat > /app/backend/test_mapping.csv << EOF
ean,marketplace,asin
0194252031391,amazon.fr,B09JQMJHXY
EOF
```

**2. Importer dans MongoDB**
```bash
cd /app/backend
mongoimport --db dropshipping --collection ean_asin_mapping \
  --type csv --headerline --file test_mapping.csv
```

**3. Vérifier**
```bash
mongo dropshipping --eval "db.ean_asin_mapping.find().pretty()"
```

**4. Tester dans l'app**
- Créer un produit fournisseur avec EAN `0194252031391`
- Aller sur "Comparaison Amazon"
- Sélectionner le fournisseur + France
- Comparer → devrait afficher le prix Amazon des AirPods Pro 2

---

## 📚 Ressources

- **Amazon PA-API Docs** : https://webservices.amazon.com/paapi5/documentation/
- **Keepa API Docs** : https://keepa.com/#!discuss/t/keepa-api/424
- **ASIN Finder** : https://www.amazon.fr/gp/product/ (coller ASIN après product/)
- **EAN Database** : https://www.ean-search.org/

---

## ✅ Checklist avant production

- [ ] Au moins 80% des produits principaux mappés
- [ ] Index MongoDB créés (performance)
- [ ] Script d'import testé et documenté
- [ ] Stratégie de fallback définie (que faire si mapping absent ?)
- [ ] Monitoring des taux de succès Keepa
- [ ] Documentation pour l'équipe

---

**💡 Conseil :** Commence par mapper manuellement tes 50 best-sellers. Cela te donnera une vue d'ensemble des opportunités avant d'investir dans l'automatisation complète.
