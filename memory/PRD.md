# EuropaDrop — PRD v1.8

### v1.8 (session 9 — fixes suppression catalogue + modales derrière navbar + clé DeepSeek UI + audit API Qogita, juillet 2026)
- **Fix bug suppression catalogue** : nouveau endpoint serveur `POST /api/products/bulk-delete` (accepte `{ids:[...]}` OU `{all:true, q, category, sync_status}`) — supprime N produits en UNE requête (avant : jusqu'à 200 requêtes DELETE parallèles vers Atlas → échecs). UI Catalogue : lien « Sélectionner les {total} produits du filtre ». Nettoie aussi supplier_products + product_mappings. ✅ testé (iteration_7, 100%).
- **Fix bug modales cachées par la navbar** : `.fade-up` (index.css) retirait `both` → supprime le `transform` persistant qui créait un contexte d'empilement faisant passer les modales `fixed z-50/60` derrière le header sticky `z-30`. ✅ 5/5 modales OK (iteration_7).
- **Clé DeepSeek dans l'UI** : page Réglages → carte « Intelligence Artificielle (DeepSeek) » (admin uniquement). `GET/PUT /api/integrations/deepseek`, stockée dans `app_settings` key `integrations:deepseek`, chargée au démarrage, prioritaire sur `.env`. `deepseek.py` : clé runtime via `set_api_key()`/`current_key()`.
- **Nettoyage DB** : 3 lignes parasites d'un mauvais import Qogita supprimées (en-tête `Name`/`GTIN` + 2 pieds de page). Migration `priceLock` = no-op (0 candidat). Catégories polluées (GTIN) : nettoyage IA reporté à la demande de l'utilisateur.
- **Audit API Qogita (EN PAUSE — l'utilisateur demande l'accès à l'API publique)** : identifiants live OK (login → accessToken). Fiable : `/auth/login/`, `/categories/` (530), `/brands/` (41925), `/variants/{gtin}/` (données riches SANS prix). NON disponible en REST : recherche texte, liste variants par catégorie, prix unitaire stable (dynamique/panier), export catalogue async/webhook (404). MVP futur envisagé : import par GTIN.
- Compte QA de test : `qa.tester@europadrop-qa.fr` / `QaTest1234!` (opérateur isolé, 12 produits jetables).

### v1.7 (session 8 — mapping IA à l'import, juillet 2026)
- **Détection auto des colonnes par IA** (DeepSeek) à l'import : `/api/ai/smart-mapping` (repli heuristique si IA absente) + bouton « Détecter les colonnes (IA) ».
- **Normalisation des catégories par IA** vers les catégories existantes de l'utilisateur : `/api/catalog/normalize-categories` + table éditable ; `categoryMap` appliqué à l'import.
- Clé **DeepSeek configurée** → traduction, SEO, actions IA en masse, mapping IA actifs.
- API **Cogita** reportée (pas d'identifiants). Le mapping IA fonctionne pour Cogita ET tout autre fournisseur.

## Tech Stack
### v1.6 (session 7 — catégories dynamiques + isolation étendue, juillet 2026)
- **Catégories dynamiques par utilisateur** : plus de liste codée en dur (niche bébé). Filtres du catalogue = `GET /api/products/categories` (distinct scopé) ; champ catégorie du formulaire produit = saisie libre + datalist. Chaque niche fonctionne.
- **Isolation étendue** à `suppliers`, `supplier-products`, `pricing-rules` (en plus de products/orders/stores/notifications/competitor-prices/settings). Calcul de prix owner-aware (`load_active_pricing_rules(owner_id)`). Vérifié : un opérateur voit 0 donnée d'autrui ; l'admin (super-admin) voit tout.
- **Suppression groupée** : Catalogue (`bulk-delete-btn`) + Commandes (`bulk-delete-orders-btn`).
- Fix seed idempotent (mot de passe admin non réinitialisé) + fichiers déploiement VPS.

## Tech Stack
### v1.5 (session 6 — CRUD complet UI + déploiement VPS, juillet 2026)
- **CRUD Produits** dans Catalogue : bouton « Nouveau produit », modal créer/modifier, boutons éditer/supprimer par ligne
- **CRUD Mappings fournisseurs** dans le drawer produit : ajouter / modifier / retirer un fournisseur mappé
- **CRUD Commandes** : « Nouvelle commande » (modal + lignes d'articles), changement de statut inline (select), suppression par ligne (+ endpoint `DELETE /api/orders/{id}`)
- **Suppression Fournisseurs** : bouton supprimer + modifier sur chaque carte
- 🔧 Fix : `refresh_product_aggregates` préserve désormais le prix/stock **saisis manuellement** quand aucun fournisseur n'est mappé
- 🚀 **Déploiement VPS** : dossier `/app/deploy/` + `docker-compose.yml` racine corrigé ; suppression des anciens fichiers legacy Node « Babyshop »
- ☁️ Preview branché sur le **MongoDB Atlas de l'utilisateur** (base `europadrop`, admin `admin@creook.fr`)

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
### v1.4 (session 5 — actuel, juillet 2026)
- **Analytics par boutique** : `/api/dashboard/store-analytics` (CA/marge/produits publiés séparés par store + bucket "Non attribuée") + table sur Dashboard
- **Actions IA en masse** depuis le catalogue : sélection multi-lignes + `/api/ai/bulk-action` (translate | seo | both) — dégrade gracieusement si clé DeepSeek absente
- **Command palette Ctrl+K** : navigation, actions rapides (export CSV, règles de prix), recherche produit live
- **Publier vers X boutiques en 1 clic** : `/api/woocommerce/bulk-publish` + modal de sélection des boutiques
- **Isolation multi-utilisateurs COMPLÈTE** : `scope_q`/`set_owner` — chaque user ne voit QUE ses stores/produits/commandes/notifs/veille-prix ; admin voit tout. Appliqué à products, orders, stores, dashboard overview + store-analytics, notifications, competitor-prices, imports catalogue
- **Multi-devise + TVA** : `/api/settings` (EUR/USD/GBP/CHF + taux + TVA TTC/HT) + page `/reglages`
- **Export CSV** : `/api/export/products.csv` + `/api/export/orders.csv`
- **Alertes prix concurrents** : `/api/competitor-prices` + page `/veille-prix` (alerte quand on est plus cher)
- 🔧 Fix env reset : recréation backend/.env + frontend/.env, pin pydantic-core==2.23.4

## Pages Frontend (15) : + /reglages + /veille-prix

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
- P0 : Renouveler clé DeepSeek (user action) pour activer traduction/SEO IA
- P1 : Notifications email (SendGrid/Resend), scraping auto des prix concurrents
- P2 : Refactor server.py en routers par domaine (~1900 lignes), per-store order attribution automatique
- Tech-debt : fail-fast si REACT_APP_BACKEND_URL manquant ; validation enum action IA

## Dates
- v1.0 : Jan 2026 · v1.1 : Jan 2026 · v1.2 : Jan 2026 · v1.3 : Jan 2026
