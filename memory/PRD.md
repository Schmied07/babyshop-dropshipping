# MarcherBien Dropship — PRD

## Problem Statement (original, verbatim)
> "je veux que tu completes les fonctionalité pour que l'aplication fonctionne comme dsers mais en mieux"

## User Choices
- **Portée** : Backend (FastAPI) enrichi + Frontend React (dashboard complet)
- **Fournisseurs** : Européens uniquement (France, Belgique, Espagne, Italie) — via API ou import catalogue. Pas d'AliExpress.
- **Formats import** : CSV, Excel (XLSX), JSON, XML
- **Fonctionnalités DSers-like activées** : multi-fournisseurs auto-select, règles de tarification, bulk fulfillment, tracking, sync stock, analytics, JWT, notifications
- **Boutique cible** : WooCommerce uniquement (marcherbien.fr)
- **IA** : DeepSeek (à ajouter plus tard avec clé — intégration préparée mais non activée)

## Tech Stack
- **Backend** : FastAPI + Motor (MongoDB) + Pydantic v2 + JWT + Passlib bcrypt + Pandas/openpyxl/xmltodict + HTTPX
- **Frontend** : React 18 + Tailwind CSS + Phosphor Icons + Recharts + Sonner (toasts) + Axios + React Router
- **DB** : MongoDB (local via supervisor)
- **Design** : Swiss & High-Contrast — Cabinet Grotesk (headings), Satoshi (body), IBM Plex Mono (data)

## Architecture
- `/app/backend/server.py` — routes API sous `/api`
- `/app/backend/models.py` — Pydantic models + PyObjectId
- `/app/backend/pricing.py` — moteur de règles de prix + auto-sélection fournisseur (cheapest/fastest/most_stock/balanced)
- `/app/backend/catalog_import.py` — parseurs multi-format
- `/app/backend/woocommerce.py` — client WC REST v3
- `/app/backend/seed.py` — données de démo (admin, 4 fournisseurs, 10 produits, 14 mappings, 4 commandes, 3 notifs, 1 règle)
- `/app/frontend/src/pages/*.jsx` — 8 pages (Login, Dashboard, Catalog, Suppliers, ImportCatalog, PricingRules, Orders, WooCommerce, Notifications)

## Features Implemented (Jan 2026)
### Backend
- ✅ Auth JWT (register, login, me) — bcrypt
- ✅ CRUD fournisseurs (avec pays, délai, expédition, note)
- ✅ CRUD produits (SKU, catégorie, marque, images, agrégats de coût/stock/prix)
- ✅ Mapping multi-fournisseurs par produit (14 mappings seedés)
- ✅ Sélection automatique du meilleur fournisseur (4 stratégies)
- ✅ Règles de tarification (markup %, arrondi, marge min, priorité, filtres catégorie/fournisseur)
- ✅ Import catalogue multi-format (CSV/XLSX/JSON/XML) avec auto-détection colonnes + coercion
- ✅ Commandes (CRUD, filtrage, bulk-fulfill avec auto-sélection fournisseur)
- ✅ Tracking colis + statuts (pending→processing→shipped→delivered)
- ✅ Sync WooCommerce (produits, stock, orders) — clés marcherbien.fr configurées, fallback mock si injoignable
- ✅ Notifications (low_stock/order_new/sync_error/price_change)
- ✅ Dashboard analytics (KPIs, top produits, série temporelle, performance fournisseurs)
- ✅ Historique des imports

### Frontend
- ✅ Login page split (form + brand panel dark)
- ✅ Sidebar dark + top bar avec badge notifications
- ✅ Dashboard : 4 metrics + revenue chart + top products + supplier performance + low stock
- ✅ Catalogue : table dense, recherche, filtres catégorie, drawer détail produit avec strategy switcher
- ✅ Fournisseurs : grille de cartes + modal CRUD
- ✅ Import catalogue : wizard 4 étapes (fichier → mapping → aperçu → résultat) + historique
- ✅ Règles de prix : simulateur temps réel + CRUD + apply-all
- ✅ Commandes : sélection multiple + bulk fulfillment + drawer détail + tracking
- ✅ WooCommerce : status de connexion + sync produit-par-produit + sync tout
- ✅ Notifications : liste avec severity colors + mark-read

## Test Status (iteration_1)
- **Backend** : 100 % (25/25 pytest tests PASS)
- **Frontend** : 100 % (tous les flows demandés vérifiés)
- **Critiques bloquants** : aucun
- **Mineurs** : bulk-fulfill sans compteur partial-fail (non-bloquant), chart avec 1 seul point car seed dates identiques

## Prioritized Backlog (P0 → P2)
### P1 (améliorations moyennes)
- Intégration DeepSeek (traduction catalogues EN/ES/IT → FR, descriptions SEO auto, mapping colonnes intelligent) — dès que la clé DeepSeek est fournie
- Splitter `server.py` en routers (auth/suppliers/products/orders/wc)
- Compteur de partial-fail sur bulk-fulfill

### P2 (nice-to-have)
- Command palette (Ctrl+K) fonctionnel avec cmdk
- Multi-devise + gestion TVA
- Export catalogue CSV
- Webhooks WooCommerce → import commandes auto
- Sync programmée (CRON stock + prix fournisseurs)
- Multi-utilisateurs avec rôles (admin/operator)
- Import via URL/API directe fournisseur (scraper)

## Credentials
- Admin : `admin@marcherbien.fr` / `Admin1234!`
- Voir `/app/memory/test_credentials.md`

## Dates
- **Version** : v1.0.0
- **Créé** : Jan 2026
- **Dernière MAJ** : Jan 2026
