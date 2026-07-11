# ✅ Checklist Complète - Mise en Place Système Dropshipping

**Durée estimée: 2-3 jours** | **Coût: 0€ (sauf VPS pour production)**

---

## 📋 PHASE 0: PRÉPARATION (1h)

- [ ] Créer dossier projet: `mkdir ~/babyshop-dropshipping`
- [ ] Télécharger tous les fichiers fournis
- [ ] Lire ce README et FOURNISSEURS_EUROPE_GUIDE.md
- [ ] Préparer identifiants fournisseurs
- [ ] Préparer clés API WooCommerce

---

## 🔧 PHASE 1: INSTALLATION (2h)

### 1.1 Node.js et npm
- [ ] Node.js v16+ installé: `node --version`
- [ ] npm v8+: `npm --version`
- [ ] Dépendances installées: `npm install`

### 1.2 MongoDB
**Option A: Installation locale**
- [ ] MongoDB installé (macOS/Ubuntu/Windows)
- [ ] Service démarré: `mongod` en arrière-plan
- [ ] Vérifier connexion: `mongosh` → `show dbs`

**Option B: MongoDB Atlas (Cloud) - Recommandé**
- [ ] Compte créé: https://www.mongodb.com/cloud/atlas
- [ ] Cluster créé: "babyshop"
- [ ] Chaîne connexion copiée
- [ ] IP blanche ajoutée (votre VPS si production)

### 1.3 Configuration fichiers
- [ ] Copier `.env.example` → `.env`
- [ ] Éditer `.env` avec valeurs:
  ```
  MONGODB_URI=mongodb+srv://user:pass@...
  WP_API_URL=https://marcherbien.fr/wp-json/wc/v3
  WP_API_KEY=ck_live_xxxxx
  WP_API_SECRET=cs_live_xxxxx
  ```

### 1.4 Import données initiales
- [ ] Exécuter: `npm run seed`
- [ ] Vérifier résultat:
  ```bash
  mongosh
  > use babyshop
  > db.suppliers.count()  # Doit afficher: 4
  > db.products.count()   # Doit afficher: 10
  ```

---

## 🌐 PHASE 2: CONFIGURATION WORDPRESS (1h)

### 2.1 Générer clés API WooCommerce
- [ ] Se connecter au Dashboard WordPress
- [ ] Aller: **WooCommerce** → **Settings** → **Advanced** → **REST API**
- [ ] Bouton **"Create an API token"**
  - Description: `Dropshipping API`
  - User: Admin
  - Permissions: `Read/Write`
- [ ] Copier **Consumer Key** → `WP_API_KEY` dans `.env`
- [ ] Copier **Consumer Secret** → `WP_API_SECRET` dans `.env`

### 2.2 Créer structure produits WordPress
**Catégories produits:**
- [ ] Créer catégorie: **Hygiène**
- [ ] Créer catégorie: **Soins**
- [ ] Créer catégorie: **Bain**
- [ ] Créer catégorie: **Repas**
- [ ] Créer catégorie: **Déplacement**
- [ ] Créer catégorie: **Kits**

**Attributs produits:**
- [ ] Créer attribut: "Tranche d'âge" (0-3 mois, 3-6 mois, etc.)
- [ ] Créer attribut: "Couleur" (Blanc, Rose, Bleu, etc.)
- [ ] Créer attribut: "Matière" (Coton, Silicone, etc.)

### 2.3 Tester connexion API
```bash
# Remplacer KEY et SECRET par vos valeurs
curl -u "ck_live_KEY:cs_live_SECRET" \
  https://marcherbien.fr/wp-json/wc/v3/products

# Doit retourner liste de produits en JSON
```

---

## 🚀 PHASE 3: LANCEMENT API (30min)

### 3.1 Démarrer l'API
```bash
# Mode développement (avec auto-reload)
npm run dev

# OU mode production
npm start
```

### 3.2 Vérifier fonctionnement
- [ ] Health check: `curl http://localhost:3000/api/health`
  - Réponse attendue: `{"status":"ok","mongodb":"connected"}`

### 3.3 Tester endpoints principaux
```bash
# Fournisseurs
curl http://localhost:3000/api/suppliers

# Produits
curl http://localhost:3000/api/products

# Dashboard
curl http://localhost:3000/api/dashboard/inventory
```

### 3.4 Tester synchronisation WordPress
```bash
# Synchroniser premier produit
curl -X POST http://localhost:3000/api/sync/product/650006a1b1b2b3b4b5b6b701

# Vérifier dans WordPress Dashboard
# Produits → Tous les produits
```

---

## 💰 PHASE 4: CONFIGURATION FOURNISSEURS (1j)

### 4.1 Contactez chaque fournisseur

**Fournisseur 1: Santé Bébé France**
- [ ] Email: contact@santebebefrance.fr
- [ ] Tel: +33 2 41 55 60 00
- [ ] Message type:
  ```
  Bonjour,
  
  Je souhaite ouvrir un compte pro pour mon e-commerce marcherbien.fr
  
  Informations:
  - SIRET: [VOTRE_SIRET]
  - Adresse: [ADRESSE]
  - N° TVA intracommunautaire: FR[SIRET]
  - Budget initial: 2000€/mois
  - Intéressé par: Hygiène, sérums, lingettes
  
  Pouvez-vous m'envoyer le catalogue et conditions?
  
  Cordialement
  ```
- [ ] Recevoir credentials de connexion
- [ ] Tester première petite commande (100€)
- [ ] Mettre à jour dans MongoDB: `db.suppliers.updateOne({name: "Santé Bébé..."}, {$set: {isActive: true}})`

**Fournisseur 2: Bébé Distribution Europe**
- [ ] Email: orders@bebedistribution.be
- [ ] Tel: +32 2 722 40 88
- [ ] Suivre même processus que Santé Bébé

**Fournisseur 3: Pedibaby Ibérica**
- [ ] Email: ventas@pedibabyiberica.es
- [ ] Tel: +34 931 123 456
- [ ] Même processus

**Fournisseur 4: Piccolini Italia**
- [ ] Email: b2b@piccoliniitalia.it
- [ ] Tel: +39 06 4588 0123
- [ ] Même processus

### 4.2 Mettre à jour MongoDB
Pour chaque fournisseur configuré:
```bash
curl -X PUT http://localhost:3000/api/suppliers/[ID] \
  -H "Content-Type: application/json" \
  -d '{
    "isActive": true,
    "rating": 4.8,
    "reviews": 120
  }'
```

### 4.3 Premier test commande
- [ ] Choisir fournisseur (Santé Bébé pour commencer)
- [ ] Passer commande manuelle par email: 50€ minimum
- [ ] Suivre livraison
- [ ] Réceptionner et contrôler qualité
- [ ] Photographier produits pour site

---

## 📸 PHASE 5: CONTENU PRODUITS (2-3h)

### 5.1 Photographier produits
- [ ] Serum physiologique (vue générale + zoom)
- [ ] Coton (packagign + usage)
- [ ] Lingettes (paquet)
- [ ] Crèmes (tube/pot)
- [ ] Accessoires bain (thermomètre, cape)
- [ ] Biberons
- [ ] Articles déplacement

### 5.2 Créer descriptions produits
Pour chaque produit:
- [ ] Titre accrocheur (ex: "Sérum Physiologique Stérile 120ml - Hygiène Bébé")
- [ ] Description courte (avantages principaux)
- [ ] Tranche d'âge recommandée
- [ ] Composition/matière
- [ ] Mode d'utilisation
- [ ] Conseils bébé

### 5.3 Uploader images
```bash
# Pour chaque produit, créer 3-4 images:
1. Photo produit haute qualité (1200x1200px)
2. Photo usage/contexte (bébé l'utilisant)
3. Gros plan détails
4. Photo packagign/boîte
```

### 5.4 Créer fiches produits WordPress
- [ ] Produit 1: Sérum physiologique
  - SKU: HYG-SERUM-0001
  - Prix: 1.99€
  - Stock: 150
  - Images: Uploader
  
- [ ] Répéter pour 9 autres produits

---

## 🔄 PHASE 6: SYNCHRONISATION COMPLÈTE (2h)

### 6.1 Synchroniser tous les produits
```bash
# Boucle pour chaque produit
for PRODUCT_ID in \
  650006a1b1b2b3b4b5b6b701 \
  650006a1b1b2b3b4b5b6b702 \
  650006a1b1b2b3b4b5b6b703 \
  650006a1b1b2b3b4b5b6b704 \
  650006a1b1b2b3b4b5b6b705; do
  curl -X POST http://localhost:3000/api/sync/product/$PRODUCT_ID
  echo "Produit $PRODUCT_ID synchronisé"
done
```

### 6.2 Vérifier synchronisation
- [ ] Aller dans **WordPress** → **Produits** → **Tous les produits**
- [ ] Voir au moins 10 nouveaux produits
- [ ] Vérifier structure (catégories, SKU, prix)
- [ ] Tester un produit en front-end

### 6.3 Mettre à jour stocks
```bash
# Après réception marchandise, mettre à jour stock
curl -X PUT http://localhost:3000/api/sync/stock/101 \
  -H "Content-Type: application/json" \
  -d '{"stock": 150}'
```

---

## 🎯 PHASE 7: TESTS (1h)

### 7.1 Tester chaque catégorie produit
- [ ] Hygiène: 6 produits visibles + filtrable par âge
- [ ] Soins: 6 produits
- [ ] Bain: 4 produits
- [ ] Repas: 3 produits
- [ ] Déplacement: 2 produits
- [ ] Kits: 4 kits composites

### 7.2 Tester panier et commande
- [ ] Ajouter produit au panier
- [ ] Voir prix correct
- [ ] Modifier quantité
- [ ] Passer commande fictive
- [ ] Vérifier email confirmation

### 7.3 Tester API endpoints
Utiliser collection Postman: `POSTMAN_REQUESTS.json`
- [ ] Test fournisseurs (GET, POST, PUT)
- [ ] Test produits (GET, POST)
- [ ] Test variantes (POST)
- [ ] Test sync WordPress (POST, PUT)
- [ ] Test dashboard (GET)

### 7.4 Tester notifications
- [ ] Stock bas (< 5 unités) → Alerte
- [ ] Fournisseur indisponible → Notification
- [ ] Sync échouée → Log d'erreur

---

## 🛡️ PHASE 8: SÉCURITÉ (30min)

### 8.1 Sécuriser fichiers
```bash
# Protéger fichier .env
chmod 600 .env

# Vérifier pas de clés dans git
grep -r "ck_live" .git/
```

### 8.2 Ajouter à .gitignore
```
.env
node_modules/
logs/
*.log
.DS_Store
```

### 8.3 Activer HTTPS
- [ ] Certificat SSL généré (Let's Encrypt gratuit)
- [ ] Redirection HTTP → HTTPS
- [ ] Vérifier `WP_SITE_URL` commence par `https://`

### 8.4 Configurer JWT optionnel
```bash
# Générer clé secrète
openssl rand -hex 32
# Ajouter à .env: JWT_SECRET=[valeur_générée]
```

---

## 📊 PHASE 9: MONITORING (30min)

### 9.1 Configurer logs
- [ ] Créer dossier: `mkdir logs`
- [ ] Redirection logs:
  ```bash
  npm start 2>&1 | tee logs/app.log
  ```

### 9.2 Activer PM2 (production)
```bash
npm install -g pm2
npm run pm2:start
pm2 save
pm2 startup
pm2 logs
```

### 9.3 Configurer alertes
- [ ] Email alerte si API down
- [ ] Slack notification pour stock bas
- [ ] Sentry pour error tracking (optionnel)

---

## 🚀 PHASE 10: PRODUCTION (OPTIONNEL)

### 10.1 Choisir hébergement
- [ ] **VPS recommandé**: DigitalOcean ($12/mois), Scaleway, Linode
- [ ] **Heroku**: Déploiement facile, plus cher ($50-100/mois)
- [ ] **Own server**: Plus contrôle mais plus compliqué

### 10.2 Déployer sur VPS
```bash
# SSH VPS
ssh root@votre-vps.com

# Cloner repo
git clone https://github.com/justme/babyshop-dropshipping.git

# Configurer
cd babyshop-dropshipping
npm install --production
cp .env.example .env
nano .env  # Remplir valeurs production

# Lancer
npm run pm2:start
```

### 10.3 Configurer domaine API
**Nginx reverse proxy:**
```nginx
server {
    listen 443 ssl;
    server_name api.marcherbien.fr;
    
    ssl_certificate /etc/letsencrypt/live/...;
    ssl_certificate_key /etc/letsencrypt/live/...;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }
}
```

### 10.4 Backup automatique
```bash
# Cron job quotidien: 02:00 du matin
2 2 * * * /home/user/babyshop-dropshipping/scripts/backup_mongo.js
```

---

## 💼 PHASE 11: DÉMARRAGE VENTES (1-2 jours avant ventes)

### 11.1 Stock initial
- [ ] Commandes passées chez tous les fournisseurs
- [ ] Budget total: 1500-2500€
- [ ] Marchandises reçues et photographiées
- [ ] Stock mis à jour dans MongoDB

### 11.2 Pricing finalisé
- [ ] Marges calculées par catégorie
- [ ] Prix de vente TTC définis
- [ ] Codes promo créés (optionnel)
- [ ] Conditions paiement/livraison définies

### 11.3 Dernier test complet
- [ ] Test commande client de bout en bout
- [ ] Vérifier tous les prix
- [ ] Vérifier tous les stocks
- [ ] Vérifier système de paiement (Stripe/PayPal)
- [ ] Vérifier emails de confirmation

### 11.4 Équipe ready
- [ ] Vous êtes formé sur API
- [ ] Vous savez passer commande chez fournisseur
- [ ] Vous savez répondre aux emails clients
- [ ] Contact fournisseurs sauvegardés

---

## 📈 PHASE 12: OPTIMISATION CONTINUE

### Semaine 1-2 après lancement
- [ ] Suivre 1ere vente complète
- [ ] Corriger bugs si besoin
- [ ] Optimiser temps traitement commandes
- [ ] Analyser fournisseur le plus rapide/fiable

### Semaine 2-4
- [ ] Augmenter budget stock
- [ ] Ajouter nouveaux produits
- [ ] Tester 5eme fournisseur
- [ ] Mettre à jour prix si marges insuffisantes

### Mois 2
- [ ] Atteindre rentabilité
- [ ] Automatiser mises à jour prix
- [ ] Créer dashboard de suivi
- [ ] Lancer campagne marketing

---

## 📞 CONTACTS IMPORTANTS

### Fournisseurs
- Santé Bébé: contact@santebebefrance.fr | +33 2 41 55 60 00
- Bébé Distribution: orders@bebedistribution.be | +32 2 722 40 88
- Pedibaby: ventas@pedibabyiberica.es | +34 931 123 456
- Piccolini: b2b@piccoliniitalia.it | +39 06 4588 0123

### Support technique
- MongoDB: support.mongodb.com
- Node.js: nodejs.org
- WooCommerce: wordpress.org/support/plugin/woocommerce/

---

## 🎉 CHECKLIST FINALE (À la fin!)

- [ ] Système complet en prod
- [ ] 10+ produits live
- [ ] 4+ fournisseurs intégrés
- [ ] Première commande reçue
- [ ] Profit positif > frais fixes
- [ ] Système stable 1 mois
- [ ] Pas erreurs critiques en logs

**Si tous les ✅: BRAVO! Système opérationnel!**

---

## ⏱️ CHRONOLOGIE RECOMMANDÉE

| Jour | Tâche | Durée | Check |
|------|-------|-------|-------|
| J1 | Installation Node + MongoDB | 2h | [ ] |
| J1 | Configuration WordPress | 1h | [ ] |
| J1 | Lancement API | 30min | [ ] |
| J2 | Contact fournisseurs | 2h | [ ] |
| J2 | 1ere commande test | 1h | [ ] |
| J3 | Photographies produits | 2h | [ ] |
| J3 | Fiches produits WordPress | 1h | [ ] |
| J4 | Synchronisation complète | 2h | [ ] |
| J4 | Tests exhaustifs | 2h | [ ] |
| J5 | Sécurité + production | 2h | [ ] |
| J5 | Lancement! 🚀 | - | [ ] |

**Total: 5 jours travail, prêt à vendre!**

---

**Version: 1.0 | Date: 18 Janvier 2024 | Status: ✅ Ready to use**

*Bonne chance avec ton système dropshipping!*
