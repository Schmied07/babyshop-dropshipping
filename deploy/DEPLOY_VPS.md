# 🚀 Déploiement EuropaDrop sur votre VPS

Stack réelle : **FastAPI (Python)** + **React** + **MongoDB Atlas** (externe) + **Nginx** (HTTPS).

> Les fichiers `Dockerfile` et `docker-compose.yml` à la RACINE du repo sont **obsolètes** (ancien projet Node « Babyshop »). Utilisez **uniquement** le dossier `deploy/`.

---

## Prérequis
- Un VPS Ubuntu 22.04+ avec accès `sudo`
- Un nom de domaine pointant (DNS **A record**) vers l'IP du VPS
- Votre cluster **MongoDB Atlas** + l'**IP du VPS autorisée** dans Atlas → *Network Access*

---

## Option A — Docker (recommandé)

```bash
# 1. Récupérez le code sur le VPS (git clone ou scp), puis :
cd europadrop/deploy
cp .env.example .env
nano .env            # remplissez MONGO_URL, DB_NAME, JWT_SECRET, APP_URL,
                     # REACT_APP_BACKEND_URL (= https://votre-domaine.com), WP_*

# 2. Build + démarrage (Mongo est sur Atlas, aucun conteneur DB requis)
docker compose up -d --build
docker compose ps
docker compose logs -f backend        # vérifiez "mongodb: connected"

# 3. Premier admin (si la base europadrop est vide)
docker compose exec backend python seed.py
```
Le conteneur frontend écoute sur `127.0.0.1:8080`. On met le **Nginx de l'hôte + HTTPS** devant :

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo cp nginx-host.conf /etc/nginx/sites-available/europadrop
sudo sed -i 's/votre-domaine.com/VOTRE_VRAI_DOMAINE/' /etc/nginx/sites-available/europadrop
sudo ln -s /etc/nginx/sites-available/europadrop /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d VOTRE_VRAI_DOMAINE      # active le TLS automatiquement
```
✅ Accédez à `https://votre-domaine.com` → connexion `admin@marcherbien.fr` / `Admin1234!`

**Mises à jour** : `git pull && docker compose up -d --build`

---

## Option B — Sans Docker (systemd + Nginx)

```bash
# Backend
sudo mkdir -p /var/www/europadrop && sudo cp -r backend frontend /var/www/europadrop/
cd /var/www/europadrop/backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp /chemin/deploy/.env.example .env && nano .env     # mêmes variables
python seed.py                                       # 1re fois
sudo cp /chemin/deploy/europadrop-backend.service /etc/systemd/system/
#  -> éditez ExecStart pour pointer sur .venv/bin/uvicorn
sudo systemctl daemon-reload && sudo systemctl enable --now europadrop-backend

# Frontend (build statique)
cd /var/www/europadrop/frontend
echo "REACT_APP_BACKEND_URL=https://votre-domaine.com" > .env
yarn install && yarn build          # génère ./build

# Nginx hôte : utilisez nginx-host.conf en décommentant la "ROUTE B", puis certbot
```

---

## ✅ Après déploiement : checklist
- [ ] `https://votre-domaine.com/api/health` renvoie `{"status":"ok","mongodb":"connected"}`
- [ ] Connexion admin OK, puis **changez le mot de passe admin** (menu Utilisateurs)
- [ ] `APP_URL` = votre domaine → indispensable pour les **webhooks WooCommerce**
- [ ] Atlas : IP du VPS autorisée (évitez `0.0.0.0/0` en prod)
- [ ] Renouvellement TLS auto : `sudo certbot renew --dry-run`

---

## Variables d'environnement clés
| Variable | Rôle |
|---|---|
| `MONGO_URL` / `DB_NAME` | Connexion MongoDB Atlas |
| `JWT_SECRET` | Signature des tokens (secret long) |
| `APP_URL` | URL publique — génère les URLs de webhook |
| `REACT_APP_BACKEND_URL` | **Build-time** frontend — = domaine public |
| `WP_API_URL/KEY/SECRET` | Boutique WooCommerce par défaut |
| `DEEPSEEK_API_KEY` | IA (traduction/SEO) — optionnel |

## Webhooks WooCommerce
WordPress → WooCommerce → Réglages → Avancé → Webhooks → Ajouter :
- URL : `https://votre-domaine.com/api/webhooks/woocommerce/orders`
- Secret : voir page **Automatisations** dans EuropaDrop
- Sujets : *Commande créée* + *Commande mise à jour* · API v3
