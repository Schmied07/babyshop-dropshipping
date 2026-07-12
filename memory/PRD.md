# EuropaDrop — PRD (v1.1)

## Problem Statement (original)
> "je veux que tu completes les fonctionalité pour que l'aplication fonctionne comme dsers mais en mieux"

## User Choices (session 1 + 2)
- **Portée** : Backend FastAPI + Frontend React
- **Fournisseurs** : Européens (FR, BE, ES, IT). Pas d'AliExpress.
- **Formats import** : CSV, XLSX, JSON, XML
- **Toutes les features DSers** activées
- **Boutique cible** : WooCommerce uniquement (marcherbien.fr)
- **IA** : DeepSeek (`deepseek-chat`) — clé fournie mais retourne 401 (à renouveler)
- **Nom de l'app** : **EuropaDrop** (v1.1)
- **CRON** : sync toutes les **6 heures**
- **Webhooks WC** : oui, URL/secret exposés

## Tech Stack
- **Backend** : FastAPI + Motor (MongoDB) + Pydantic v2 + JWT/bcrypt + Pandas/openpyxl/xmltodict + HTTPX + APScheduler
- **Frontend** : React 18 + Tailwind + Phosphor Icons + Recharts + Sonner + Axios + React Router
- **Design** : Swiss & High-Contrast — Cabinet Grotesk / Satoshi / IBM Plex Mono
- **AI** : DeepSeek (OpenAI-compatible API) — `deepseek-chat`

## Architecture
- `/app/backend/server.py` — routes API `/api`
- `/app/backend/models.py` — Pydantic + PyObjectId
- `/app/backend/pricing.py` — moteur règles + auto-sélection fournisseur
- `/app/backend/catalog_import.py` — parseurs multi-format
- `/app/backend/woocommerce.py` — client WC REST v3
- `/app/backend/deepseek.py` — client DeepSeek (translation, SEO, smart mapping)
- `/app/backend/scheduler.py` — APScheduler (sync 6h + import WC 30min)
- `/app/backend/seed.py` — données de démo
- `/app/frontend/src/pages/` — 9 pages (Login, Dashboard, Catalog, Suppliers, ImportCatalog, PricingRules, Orders, WooCommerce, Automations, Notifications)

## Features Implemented

### v1.0 (session 1) — Core DSers-like
- Auth JWT (bcrypt) + admin seedé
- CRUD fournisseurs (4 UE seedés)
- CRUD produits (10 seedés) avec agrégats coût/stock/prix
- Multi-mapping fournisseurs (14 seedés)
- **Auto-sélection fournisseur** (cheapest/fastest/most_stock/balanced)
- Règles de tarification (markup, arrondis, marge min, priorité) + simulateur
- Import catalogue CSV/XLSX/JSON/XML avec auto-mapping colonnes
- Commandes CRUD + **bulk fulfillment**
- **Tracking** colis multi-transporteurs
- Sync WooCommerce produits/stock/commandes
- Notifications multi-sévérité
- Dashboard analytics (KPIs, chart 14j, top produits, perf fournisseurs)

### v1.1 (session 2) — Nouveautés
- ✅ **Rebrand EuropaDrop** (sidebar, login, titre, PRD)
- ✅ **Vue produits Importés / Publiés** (3 tabs comme DSers) avec badges "Publié"/"Non publié" + `wpProductId`
- ✅ **Suivi paiements** : `paymentStatus` (unpaid/paid/refunded/partial_refund) + `paymentMethod` + `paymentReference` + `paidAt`. UI badges + section paiement dans drawer commande.
- ✅ **DeepSeek AI** :
  - `POST /api/ai/translate` — traduction FR (EN/ES/IT)
  - `POST /api/ai/seo-description` — description SEO structurée (titre, meta, description HTML, keywords)
  - `POST /api/ai/smart-mapping` — mapping intelligent colonnes CSV
  - `POST /api/ai/bulk-translate-products` — traduction en masse
  - ⚠️ **Clé DeepSeek fournie renvoie 401** — utilisateur doit renouveler
- ✅ **Webhooks WooCommerce** :
  - `POST /api/webhooks/woocommerce/orders` — signature HMAC-SHA256
  - `GET /api/webhooks/woocommerce/info` — URL + secret + instructions FR
  - Page **Automatisations** avec Copy buttons
- ✅ **CRON APScheduler** (toutes les 6h) :
  - Job 1 : sync produits + push WooCommerce (`stocks_prices_sync`, every 6h)
  - Job 2 : import commandes WooCommerce (`wc_orders_import`, every 30min)
  - `POST /api/scheduler/run-now/{job_id}` pour déclenchement manuel
  - `GET /api/scheduler/status` + `/history`

## Test Status
### iteration_1
- Backend : 25/25 ✅
- Frontend : 100% ✅

### iteration_2
- Backend : 15/15 nouveaux tests ✅ + 24/25 regression (1 test non-idempotent, pas de bug)
- Frontend : 100% ✅
- DeepSeek : code correct, clé user invalide (401)

## Prioritized Backlog

### P0 (bloquant utilisateur)
- **Renouveler clé DeepSeek** (utilisateur) — obtenir nouvelle clé sur platform.deepseek.com

### P1 (améliorations)
- Splitter `server.py` en routers (auth/suppliers/products/orders/wc/ai)
- Compteur partial-fail sur bulk-fulfill
- Actions IA en masse depuis catalog (bouton "Traduire tous" / "SEO tous")

### P2 (nice-to-have)
- Command palette Ctrl+K fonctionnel (cmdk)
- Multi-devise + gestion TVA
- Export catalogue CSV
- Multi-utilisateurs avec rôles
- Import URL fournisseur (scraper direct)
- Alertes prix concurrents

## Credentials
- Admin : `admin@marcherbien.fr` / `Admin1234!`
- WooCommerce : ck_8e4... / cs_e83... (dans .env)
- DeepSeek : `sk-5c53750be5d5474ba56b9480094433e6` (invalide — à renouveler)
- Webhook secret : `europadrop_wh_secret_change_me_2026`

## Dates
- **v1.0** : Jan 2026 (session 1)
- **v1.1** : Jan 2026 (session 2 — EuropaDrop rebrand + AI + webhooks + CRON)
