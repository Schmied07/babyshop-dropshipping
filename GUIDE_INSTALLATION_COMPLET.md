# Guide Complet - Installation Système Dropshipping Babyshop

## 📋 Table des matières
1. Prérequis
2. Installation MongoDB
3. Installation API Node.js
4. Configuration WordPress
5. Tests et déploiement
6. Maintenance quotidienne

---

## 1. PRÉREQUIS

### Hardware minimum
- Serveur VPS avec 2GB RAM minimum
- 20GB espace disque
- CPU 2 cores
- Bande passante: 100MB min

### Logiciels requis
- Node.js v16+ (npm v8+)
- MongoDB 4.4+
- WordPress 6.0+
- PHP 7.4+

### Services externes
- Compte WooCommerce configuré
- Clés API WooCommerce générées
- Fournisseurs européens contactés

---

## 2. INSTALLATION MONGODB

### Option A: Installation locale (Développement)

**Ubuntu/Debian:**
```bash
# Installer MongoDB
sudo apt-get update
sudo apt-get install -y mongodb-org

# Démarrer le service
sudo systemctl start mongod
sudo systemctl enable mongod

# Vérifier statut
sudo systemctl status mongod
```

**macOS:**
```bash
# Avec Homebrew
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Windows:**
- Télécharger depuis: https://www.mongodb.com/try/download/community
- Installer en tant que service Windows
- Accès: `mongodb://localhost:27017`

### Option B: Atlas Cloud (Production recommandé)

```bash
# 1. Aller sur https://www.mongodb.com/cloud/atlas
# 2. Créer compte gratuit (512MB)
# 3. Créer cluster "babyshop"
# 4. Générer chaîne de connexion
# 5. Ajouter IP blanche

# Exemple de connexion:
mongodb+srv://user:password@cluster.mongodb.net/babyshop
```

### Import des données de base

```bash
# Se connecter à MongoDB
mongosh

# Utiliser la base
use babyshop

# Importer le script de seeding
load("./mongodb_babyshop_seed.js")

# Vérifier collections
show collections

# Vérifier nombre de documents
db.suppliers.countDocuments()      # Doit afficher: 4
db.products.countDocuments()       # Doit afficher: 10
db.brands.countDocuments()         # Doit afficher: 5
```

---

## 3. INSTALLATION API NODE.JS

### Installation de base

```bash
# Créer dossier projet
mkdir babyshop-dropshipping
cd babyshop-dropshipping

# Initialiser npm
npm init -y

# Installer dépendances
npm install express mongoose axios dotenv cors helmet
npm install --save-dev nodemon

# Créer structure
mkdir src routes models middleware
touch .env api_dropshipping.js
```

### Package.json complet

```json
{
  "name": "babyshop-dropshipping-api",
  "version": "1.0.0",
  "description": "API de gestion dropshipping pour marcherbien.fr",
  "main": "api_dropshipping.js",
  "scripts": {
    "start": "node api_dropshipping.js",
    "dev": "nodemon api_dropshipping.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.0.0",
    "axios": "^1.3.0",
    "dotenv": "^16.0.3",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.0"
  },
  "devDependencies": {
    "nodemon": "^2.0.20",
    "jest": "^29.5.0"
  }
}
```

### Fichier .env

Créer `.env` à la racine du projet:

```env
# MONGODB
MONGODB_URI=mongodb://localhost:27017/babyshop
# Ou pour Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/babyshop

# WOOCOMMERCE
WP_API_URL=https://marcherbien.fr/wp-json/wc/v3
WP_API_KEY=ck_live_xxxxxxxxxxxxx
WP_API_SECRET=cs_live_xxxxxxxxxxxxx

# SERVEUR
PORT=3000
NODE_ENV=development

# JWT (optionnel, pour authentification)
JWT_SECRET=votre_clé_secrète_complexe_ici

# LOGS
LOG_LEVEL=info
```

### Démarrer l'API

```bash
# Mode développement (avec rechargement auto)
npm run dev

# Mode production
npm start
```

**Vérifier que tout fonctionne:**
```bash
curl http://localhost:3000/api/health
# Doit retourner: {"status":"ok","mongodb":"connected"}
```

---

## 4. CONFIGURATION WORDPRESS

### 4.1 Générer les clés API WooCommerce

```
1. Aller dans WordPress Dashboard
2. WooCommerce → Settings → Advanced → REST API
3. Créer une nouvelle clé:
   - Description: "Dropshipping API"
   - User: Admin
   - Permissions: Read/Write
4. Générer
5. Copier Consumer Key et Consumer Secret
6. Ajouter dans fichier .env
```

### 4.2 Structure produits WordPress

**Créer les catégories:**
- Hygiène
- Soins
- Bain
- Repas
- Déplacement
- Kits

**Créer les tags de tranche d'âge:**
- 0-3 mois
- 3-6 mois
- 6-12 mois
- 1-3 ans

### 4.3 Plugin recommandé: WooCommerce Dropshipping

```bash
# Installer via WordPress CLI:
wp plugin install woocommerce-dropshipping --activate

# Ou manuellement:
# 1. Télécharger https://wordpress.org/plugins/
# 2. Importer en Plugins → Add New → Upload
```

### 4.4 Configuration manuelle pour synchronisation

**Ajouter du code custom dans `functions.php`:**

```php
<?php
// Hook de mise à jour stock
add_action('woocommerce_product_set_stock', 'sync_stock_to_dropshipping');

function sync_stock_to_dropshipping($product_id) {
    $product = wc_get_product($product_id);
    $stock = $product->get_stock_quantity();
    $wp_id = get_post_meta($product_id, '_wp_product_id', true);
    
    // Appeler API dropshipping
    $response = wp_remote_put(
        'http://localhost:3000/api/sync/stock/' . $wp_id,
        array(
            'method' => 'PUT',
            'headers' => array('Content-Type' => 'application/json'),
            'body' => json_encode(['stock' => $stock])
        )
    );
    
    error_log('Stock sync: ' . print_r($response, true));
}

// Hook de nouvelle commande
add_action('woocommerce_order_status_completed', 'notify_supplier_order');

function notify_supplier_order($order_id) {
    $order = wc_get_order($order_id);
    
    // Appeler API pour notifier fournisseur
    wp_remote_post('http://localhost:3000/api/orders/notify', array(
        'body' => json_encode($order->get_data())
    ));
}
?>
```

### 4.5 Afficher info fournisseur en front

**Dans produit.php (template WooCommerce):**

```php
<?php
// Après le prix du produit
$product_id = get_the_ID();
$supplier_info = get_post_meta($product_id, '_supplier_info', true);

if ($supplier_info) {
    echo '<div class="supplier-info">';
    echo '<p><strong>Livraison en ' . $supplier_info['leadtime'] . ' jours</strong></p>';
    echo '<p>Fournisseur: ' . $supplier_info['name'] . '</p>';
    echo '</div>';
}
?>
```

---

## 5. TESTS ET DÉPLOIEMENT

### 5.1 Tests locaux

**Vérifier collections MongoDB:**
```bash
# Commandes mongosh
db.suppliers.find().pretty()
db.products.find({categoryId: ObjectId("...")}).pretty()
db.productVariants.findOne()
```

**Tester endpoints API:**

```bash
# Récupérer tous fournisseurs
curl http://localhost:3000/api/suppliers

# Récupérer produit avec détails
curl http://localhost:3000/api/products/650006a1b1b2b3b4b5b6b701/details

# Synchroniser produit vers WordPress
curl -X POST http://localhost:3000/api/sync/product/650006a1b1b2b3b4b5b6b701

# Vérifier dashboard
curl http://localhost:3000/api/dashboard/inventory
```

### 5.2 Checklist avant production

- ✅ MongoDB sauvegardé (backup)
- ✅ Clés API WooCommerce générées et testées
- ✅ Variables .env configurées
- ✅ HTTPS activé sur le domaine
- ✅ Firewall configuré (port 3000 en interne seulement)
- ✅ Logs configurés
- ✅ Monitoring activé

### 5.3 Déploiement (exemple Heroku)

```bash
# Créer app Heroku
heroku create babyshop-dropshipping-api

# Ajouter MongoDB Atlas
heroku addons:create mongolab:sandbox

# Pousser le code
git push heroku main

# Définir variables d'env
heroku config:set WP_API_KEY=ck_live_xxx
heroku config:set WP_API_SECRET=cs_live_xxx

# Vérifier logs
heroku logs --tail
```

### 5.4 Configuration Nginx/Apache (sur VPS)

**Nginx (reverse proxy):**

```nginx
server {
    listen 80;
    server_name api.marcherbien.fr;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Apache:**

```apache
<VirtualHost *:80>
    ServerName api.marcherbien.fr
    
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
</VirtualHost>
```

---

## 6. MAINTENANCE QUOTIDIENNE

### 6.1 Vérifications quotidiennes (15 minutes)

```bash
# Check API santé
curl https://api.marcherbien.fr/api/health

# Vérifier stock bas
curl https://api.marcherbien.fr/api/dashboard/inventory | jq '.data.lowStockItems'

# Vérifier derniers logs
tail -100 /var/log/dropshipping-api/error.log
```

### 6.2 Tâches hebdomadaires

**Mise à jour prix/stock fournisseur:**
```bash
# Script: update_supplier_prices.js
node scripts/update_supplier_prices.js

# Cela va:
# 1. Contacter les fournisseurs (API ou scraping)
# 2. Mettre à jour les prix
# 3. Alerter si rupture de stock
# 4. Synchroniser WordPress
```

**Backup MongoDB:**
```bash
# Backup complet
mongodump --uri="mongodb://localhost:27017/babyshop" \
          --out=/backups/babyshop_$(date +%Y%m%d)

# Ou sur Atlas (automatique)
# Vérifier dans: Atlas Dashboard → Backup
```

**Réconciliation des commandes:**
```bash
# Récupérer commandes non traitées
curl https://api.marcherbien.fr/api/orders/recent?status=processing
```

### 6.3 Tâches mensuelles

- 📊 Analyser marges et rentabilité
- 📈 Mettre à jour stratégie de pricing
- 🔄 Négocier volumes avec fournisseurs
- 📋 Auditer stock et produits inactifs
- 🔐 Vérifier logs sécurité

### 6.4 Monitoring recommandé

**PM2 (pour garder API en vie):**

```bash
npm install -g pm2

# Créer ecosystem.config.js
pm2 start api_dropshipping.js --name "babyshop-api"
pm2 save
pm2 startup
pm2 monit
```

**Alertes:**
- Stock < 5 unités
- Fournisseur indisponible
- Sync WordPress échouée
- API down
- MongoDB connexion lost

---

## 7. STRUCTURE FINALE

```
babyshop-dropshipping/
├── api_dropshipping.js
├── mongodb_babyshop_seed.js
├── package.json
├── .env
├── .env.example
├── README.md
├── routes/
│   ├── suppliers.js
│   ├── products.js
│   ├── sync.js
│   └── orders.js
├── models/
│   ├── Supplier.js
│   ├── Product.js
│   ├── ProductVariant.js
│   └── ProductMapping.js
├── middleware/
│   ├── auth.js
│   └── errorHandler.js
├── scripts/
│   ├── update_supplier_prices.js
│   ├── sync_wordpress.js
│   └── backup_mongo.js
├── logs/
│   ├── error.log
│   ├── access.log
│   └── sync.log
└── tests/
    ├── suppliers.test.js
    ├── products.test.js
    └── sync.test.js
```

---

## 8. DÉPANNAGE COURANT

### "MongoDB connection refused"
```bash
# Vérifier service MongoDB
sudo systemctl status mongod
# Redémarrer si nécessaire
sudo systemctl restart mongod
```

### "WooCommerce API unauthorized"
```
1. Vérifier clés API dans WordPress
2. Vérifier IP blanche autorisée
3. Vérifier format Basic Auth
```

### "Port 3000 déjà en utilisation"
```bash
# Trouver processus
lsof -i :3000
# Tuer processus
kill -9 <PID>
```

### "Produits pas synchronisés"
```bash
# Logs complètes
npm run dev 2>&1 | tee sync.log
# Vérifier réponse API
curl -v http://localhost:3000/api/sync/product/ID
```

---

## 9. RESSOURCES SUPPLÉMENTAIRES

- MongoDB Documentation: https://docs.mongodb.com/
- WooCommerce REST API: https://woocommerce.com/document/rest-api/
- Express.js Guide: https://expressjs.com/
- PM2 Documentation: https://pm2.keymetrics.io/
- Nginx Reverse Proxy: https://nginx.org/en/docs/

---

## 📞 Support

Pour des questions ou problèmes:
- Consulter logs: `tail -f logs/error.log`
- Tester endpoints: Postman collection fournie
- Contacter fournisseurs directement si problème livraison

**Version du document**: 1.0 - Janvier 2024
