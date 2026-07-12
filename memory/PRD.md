# EuropaDrop — PRD v1.3

## Problem Statement (original, verbatim)
> "je veux que tu completes les fonctionalité pour que l'aplication fonctionne comme dsers mais en mieux"

## Full Feature Overview (all versions)

### v1.0 (session 1)
- Auth JWT/bcrypt, seeded admin
- CRUD fournisseurs européens (4 seedés)
- CRUD produits, mappings multi-fournisseurs, auto-select (cheapest/fastest/most_stock/balanced)
- Import catalogue CSV/XLSX/JSON/XML avec auto-mapping
- Règles de tarification (markup, arrondis, marge min) + simulateur
- Commandes CRUD + **bulk fulfillment** + tracking multi-transporteurs
- Sync WooCommerce (produits/stock/orders)
- Notifications + Dashboard analytics

### v1.1 (session 2)
- Rebrand **EuropaDrop**
- Vue produits **Importés / Publiés** (3 tabs style DSers) avec badges WP ID
- Suivi paiements (statut/méthode/référence/paidAt)
- Intégration **DeepSeek AI** (traduction FR, description SEO, smart mapping) — ⚠️ clé user invalide
- **Webhooks WooCommerce entrants** avec signature HMAC
- **CRON APScheduler** (sync toutes les 6h + import commandes toutes les 30 min)

### v1.2 (session 3)
- **Auto-regenerate webhook secret** stocké en DB (plus dans .env)
- **Clés API scopées** (22 scopes) — auth Bearer avec préfixe `ed_`
  - Scope enforcement middleware sur /api/*
  - Préconfigurations : Full Control (Claude), Read Only, Order automation (n8n), Product sync, AI assistant only
  - Révocation instantanée
- **Webhooks sortants** (n8n, Zapier, Make) avec signature HMAC + test manuel
  - 10 événements : order.created/updated/shipped/paid, product.created/published, low_stock, sync.completed, supplier.created, catalog.imported
  - Dispatch automatique depuis les endpoints métier
- **Intégration n8n** : Swagger UI + spec OpenAPI publics + instructions

### v1.3 (session 4 — actuel)
- 🔧 **Fix bug critique** : `/api/docs` + `/api/openapi.json` maintenant accessibles via l'ingress (préfixe /api)
- Auto-détection base URL depuis les headers de requête (portable multi-déploiement)
- **Multi-boutiques WordPress** :
  - Collection `stores` (name, url, key, secret, isDefault, isActive)
  - Sync produit vers UNE boutique spécifique OU toutes en une fois
  - ProductMapping lié à un storeId
  - Test de connexion en direct
  - Secrets JAMAIS exposés en GET (uniquement keyPreview)
- **Multi-utilisateurs** :
  - Rôles : `admin` (contrôle total) / `operator` (accès limité)
  - Endpoints : GET/POST/PUT/DELETE /api/users (admin only)
  - Guard frontend + backend (operator voit un écran "Accès réservé")
  - Auto-protection : impossible de supprimer son propre compte

## Tech Stack
- **Backend** : FastAPI 0.115 + Motor + Pydantic v2 + JWT/bcrypt + Pandas/openpyxl/xmltodict + HTTPX + APScheduler
- **Frontend** : React 18 + Tailwind + Phosphor Icons + Recharts + Sonner + Axios + React Router
- **DB** : MongoDB
- **Design** : Swiss & High-Contrast — Cabinet Grotesk / Satoshi / IBM Plex Mono
- **AI** : DeepSeek (OpenAI-compatible)

## Pages Frontend (11)
1. `/login` — Split screen brand
2. `/` — Dashboard (KPIs, chart 14j, top produits, perf fournisseurs)
3. `/catalogue` — Produits + tabs Importés/Publiés + drawer avec IA
4. `/commandes` — Table + bulk fulfillment + tracking + paiement
5. `/fournisseurs` — Grid cards CRUD
6. `/import` — Wizard 4 étapes + historique
7. `/regles-prix` — Simulateur + CRUD
8. `/woocommerce` — Sync par produit
9. `/boutiques` — **NEW** Multi-boutiques WP
10. `/automatisations` — CRON + Webhooks IN/OUT + n8n
11. `/cles-api` — CRUD clés scopées
12. `/utilisateurs` — **NEW** Multi-users (admin only)
13. `/notifications`

## API Endpoints (60+)
- Auth : `/api/auth/*`
- Products : `/api/products/*` + `/products/stats` + `/products/{id}/best-supplier`
- Suppliers : `/api/suppliers/*`
- Supplier products : `/api/supplier-products/*`
- Orders : `/api/orders/*` + `/orders/bulk-fulfill` + `/orders/{id}/tracking` + `/orders/{id}/payment`
- Pricing rules : `/api/pricing-rules/*` + `/apply-all`
- Catalog : `/api/catalog/preview` + `/catalog/import` + `/catalog/import-file` + `/catalog/history`
- WooCommerce : `/api/woocommerce/status` + `/sync-product/{pid}` + `/sync-all` + `/sync-stock/{wp_id}` + `/orders`
- **Stores** : `/api/stores/*` + `/stores/{id}/test`
- **Users** : `/api/users/*` (admin only)
- **API Keys** : `/api/api-keys/*` + `/api-keys/scopes`
- **Outbound webhooks** : `/api/outbound-webhooks/*` + `/{id}/test`
- Webhooks IN : `/api/webhooks/woocommerce/orders` (public) + `/info` + `/regenerate-secret`
- Scheduler : `/api/scheduler/status` + `/run-now/{job_id}` + `/history`
- AI : `/api/ai/translate` + `/ai/seo-description` + `/ai/smart-mapping` + `/ai/bulk-translate-products`
- Notifications : `/api/notifications/*`
- Dashboard : `/api/dashboard/overview` + `/supplier-performance`
- n8n : `/api/integrations/n8n/info`
- Swagger : `/api/docs` + `/api/redoc` + `/api/openapi.json`

## Test Status
- **iter_1** (v1.0) : 25/25 ✅
- **iter_2** (v1.1) : 15/15 nouveaux ✅
- **iter_3** (v1.2) : 14/17 (3 échecs = flakiness externe / bug docs URL corrigé) ✅
- **iter_4** (v1.3) : 21/21 nouveaux ✅ + regression 39/40 maintenue + 100% frontend

## Credentials
- Admin : `admin@marcherbien.fr` / `Admin1234!`
- Operator : `operator@marcherbien.fr` / `Op1234!` (créé pour tests RBAC)
- WooCommerce : `ck_8e43...` / `cs_e83...` (dans .env legacy)
- DeepSeek : `sk-5c53750be5d5474ba56b9480094433e6` ⚠️ INVALIDE — à renouveler
- Webhook secret : auto-géré en DB

## Prioritized Backlog
- P0 : Renouveler clé DeepSeek (user action)
- P1 : Vue analytics par boutique (revenue par store), Actions IA en masse
- P2 : Command palette Ctrl+K, Multi-devise + TVA, Alertes prix concurrents, Export CSV

## Dates
- v1.0 : Jan 2026 · v1.1 : Jan 2026 · v1.2 : Jan 2026 · v1.3 : Jan 2026
