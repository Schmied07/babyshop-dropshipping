# 🎯 Babyshop Dropshipping - Système Complet

**Système de gestion dropshipping pour marcherbien.fr**
- Gestion MongoDB pour produits, fournisseurs, stocks
- API Node.js complète
- Synchronisation WooCommerce automatique
- Fournisseurs européens intégrés
- Dashboard et analytics

---

## ✨ Fonctionnalités Principales

✅ **Gestion Fournisseurs**
- 4+ fournisseurs européens configurés
- Tarifs, délais et conditions actualisés
- Gestion des stocks en temps réel
- Calcul automatique des marges

✅ **Gestion Produits**
- 10+ produits initiaux pour démarrer
- Catégories organisées (Hygiène, Soins, Bain, Repas, Déplacement)
- Variantes (tailles, packagings, couleurs)
- Mapping SKU automatique

✅ **Synchronisation WooCommerce**
- Import/export automatique des produits
- Synchronisation des stocks en temps réel
- Gestion des variantes de produits
- Tracking des commandes

✅ **Dashboard Analytics**
- Vue d'ensemble du stock
- Calcul des marges par fournisseur
- Alertes de rupture de stock
- Suivi des commandes

✅ **API REST Complète**
- 20+ endpoints documentés
- Authentification JWT optionnelle
- Rate limiting et sécurité
- Logs détaillés

---

## 🚀 Démarrage Rapide (5 minutes)

### 1. Prérequis
```bash
# Vérifier versions
node --version  # v16+
npm --version   # v8+

# Installer MongoDB localement (optionnel, Atlas recommandé)
# macOS: brew install mongodb-community
# Ubuntu: sudo apt-get install mongodb-org
# Ou créer compte Atlas: https://www.mongodb.com/cloud/atlas
```

### 2. Installation
```bash
# Cloner/télécharger les fichiers
git clone https://github.com/justme/babyshop-dropshipping.git
cd babyshop-dropshipping

# Installer dépendances
npm install

# Créer fichier de configuration
cp .env.example .env
# Éditer .env avec vos valeurs
nano .env  # ou vim/notepad
```

### 3. Configuration MongoDB
```bash
# Si utilisation locale
mongod --fork --logpath /var/log/mongod.log

# Seed données initiales
npm run seed
```

### 4. Configuration WordPress
```
1. Aller dans WordPress Dashboard
2. WooCommerce → Settings → Advanced → REST API
3. Créer nouvelle clé:
   - Description: "Dropshipping API"
   - User: Admin (ou utilisateur auto-entrepreneur)
   - Permissions: Read/Write
4. Copier Consumer Key → WP_API_KEY
5. Copier Consumer Secret → WP_API_SECRET
6. Mettre dans .env
```

### 5. Lancer l'API
```bash
# Mode développement (auto-reload)
npm run dev

# Vérifier santé
curl http://localhost:3000/api/health
# Réponse: {"status":"ok","mongodb":"connected"}
```

✅ **Système prêt!** Accès API sur `http://localhost:3000`

---

## 📚 Documentation Complète

### Fichiers Principaux

| Fichier | Description |
|---------|-------------|
| `api_dropshipping.js` | API Express.js complète (20+ endpoints) |
| `mongodb_babyshop_seed.js` | Script de remplissage données initiales |
| `FOURNISSEURS_EUROPE_GUIDE.md` | Guide complet des 4 fournisseurs + tarifs |
| `GUIDE_INSTALLATION_COMPLET.md` | Installation pas-à-pas (MongoDB, API, WordPress) |
| `POSTMAN_REQUESTS.json` | Collection Postman (30+ requêtes de test) |
| `.env.example` | Template configuration (copier en .env) |

### Documentation par fonction

**🏭 Gestion Fournisseurs**
- Fournisseur 1: Santé Bébé France (hygiène, prix bas, rapide)
- Fournisseur 2: Bébé Distribution (soins, service, Belgique)
- Fournisseur 3: Pedibaby Ibérica (déplacement, compétitif)
- Fournisseur 4: Piccolini Italia (premium, soin naturel)

Voir: `FOURNISSEURS_EUROPE_GUIDE.md` (détails complets + contacts)

**📦 Produits Initiaux**

Hygiène (6 produits):
- Sérum physiologique 120ml → VRP 1.99€
- Coton bio 100 unités → VRP 3.99€
- Lingettes paquet 80 → VRP 2.49€
- Et 3 autres...

Soins, Bain, Repas, Déplacement: 4 produits par catégorie

Kits (regroupements):
- Kit Naissance → 49.99€
- Kit Bain → 34.99€
- Kit Rhume → 24.99€
- Kit Cadeau Premium → 59.99€

**🔄 Collections MongoDB**

```
babyshop/
  ├── suppliers (4 docs)
  ├── products (10 docs)
  ├── productVariants (4 docs+)
  ├── supplierProducts (5 docs+)
  ├── productMappings (sync WordPress)
  ├── brands (5 docs)
  ├── categories (6 docs)
  ├── attributes (5 docs)
  ├── attributeValues (12 docs)
  └── supplierCatalogs (2 docs)
```

---

## 🔌 Endpoints API

### Fournisseurs
```
GET    /api/suppliers              # Lister tous
GET    /api/suppliers/:id          # Détails fournisseur
POST   /api/suppliers              # Créer
PUT    /api/suppliers/:id          # Mettre à jour
```

### Produits
```
GET    /api/products?page=1&limit=20
GET    /api/products/:id/details   # Avec variantes + fournisseurs
POST   /api/products               # Créer
POST   /api/products/:id/variants  # Ajouter variante
```

### Fournisseur Produits
```
GET    /api/supplier-products
POST   /api/supplier-products      # Ajouter mapping
PUT    /api/supplier-products/:id  # Mettre à jour prix/stock
```

### WordPress Sync
```
POST   /api/sync/product/:id           # Créer produit WP
PUT    /api/sync/stock/:wpProductId    # Mettre à jour stock
GET    /api/orders/recent?limit=50     # Récupérer commandes
```

### Dashboard
```
GET    /api/dashboard/inventory              # Stock overview
GET    /api/dashboard/supplier-margins/:id   # Analyser marges
GET    /api/health                           # Santé système
```

**Voir `POSTMAN_REQUESTS.json` pour toutes les requêtes avec exemples**

---

## 🎬 Workflow Typical

### 1. Commencer chaque jour
```bash
# Vérifier API
curl http://localhost:3000/api/health

# Voir stock bas
curl http://localhost:3000/api/dashboard/inventory
```

### 2. Ajouter nouveau produit
```bash
# 1. Contacter fournisseur, obtenir référence
# 2. Créer produit dans MongoDB
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"sku":"...", "name":"...", ...}'

# 3. Créer variantes
curl -X POST http://localhost:3000/api/products/[ID]/variants \
  -H "Content-Type: application/json" \
  -d '{"sku":"...", "costPrice":0.50, ...}'

# 4. Ajouter fournisseur mapping
curl -X POST http://localhost:3000/api/supplier-products \
  -d '{"supplierId":"...", "productId":"...", ...}'

# 5. Synchroniser WordPress
curl -X POST http://localhost:3000/api/sync/product/[ID]
```

### 3. Renouveler stock
```bash
# 1. Vérifier stock bas
curl http://localhost:3000/api/dashboard/inventory

# 2. Passer commande chez fournisseur (manuelle par email)

# 3. Quand livraison reçue, mettre à jour stock
curl -X PUT http://localhost:3000/api/supplier-products/[ID] \
  -d '{"stock":300}'

# 4. Synchroniser WordPress automatiquement
# Chaque matin: npm run sync:wp
```

---

## 💰 Stratégie de Marges

### Prix de base
- Hygiène: Coût HT × 3-4 → VRP 340% marge
- Soins: Coût HT × 3 → VRP 265% marge
- Bain: Coût HT × 4 → VRP 350% marge
- Repas: Coût HT × 3 → VRP 300% marge
- Déplacement: Coût HT × 3.5 → VRP 250% marge

### Exemple concret
```
Sérum Physiologique:
  Coût fournisseur: 0.45€ HT
  × 3 = 1.35€ (mini)
  × 4.4 = 1.99€ (recommandé)
  Marge réelle: 1.99 - 0.45 = 1.54€ (77% marge brute)
```

### Stratégie complète
Voir: `FOURNISSEURS_EUROPE_GUIDE.md` (section 5: Calcul des marges)

---

## 🔐 Sécurité

### Checklist avant production
- [ ] Fichier `.env` avec vraies clés
- [ ] HTTPS activé sur domaine
- [ ] MongoDB sauvegardé
- [ ] Firewall configuré (port 3000 caché)
- [ ] JWT activé pour API
- [ ] Rate limiting activé
- [ ] Logs configurés
- [ ] Monitoring en place

### Commandes sécurité
```bash
# Générer clé JWT complexe
openssl rand -hex 32

# Chiffrer fichier .env
gpg --encrypt --recipient email@example.com .env

# Vérifier permissions
chmod 600 .env
chmod 644 api_dropshipping.js
```

---

## 📊 Monitoring & Logs

### Voir les logs en direct
```bash
npm run dev
# Logs complets avec timestamps

# Ou via PM2
npm run pm2:logs
```

### Logs fichiers
```bash
# Erreurs
tail -f logs/error.log

# Accès
tail -f logs/access.log

# Sync WordPress
tail -f logs/sync.log
```

### Metrics importantes
- Requêtes/sec
- Temps réponse API
- Erreurs de synchronisation
- Stock bas alertes
- Fournisseurs indisponibles

---

## 🚢 Déploiement Production

### Option 1: VPS (Recommandé)
```bash
# Sur DigitalOcean, Linode, Scaleway, etc.
ssh root@votre-vps.com

# Cloner repo
git clone https://github.com/justme/babyshop-dropshipping.git

# Installer dépendances
cd babyshop-dropshipping
npm install --production

# Configurer .env
nano .env

# Lancer avec PM2
npm install -g pm2
npm run pm2:start
pm2 startup
pm2 save
```

### Option 2: Heroku (Rapide)
```bash
heroku create babyshop-dropshipping-api
git push heroku main
heroku config:set MONGODB_URI=...
heroku config:set WP_API_KEY=...
```

### Option 3: Docker (Scalable)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "api_dropshipping.js"]
```

---

## 🐛 Dépannage

### MongoDB connection refused
```bash
# Vérifier service
sudo systemctl status mongod

# Ou avec Homebrew
brew services list

# Redémarrer
sudo systemctl restart mongod
```

### WooCommerce API error
```bash
# Vérifier clés
1. WordPress Dashboard → WooCommerce → REST API
2. Tester dans terminal:
curl -u "key:secret" https://marcherbien.fr/wp-json/wc/v3/products

# Vérifier IP blanche (Atlas)
# Si sur VPS: ajouter IP VPS en IP autorisée
```

### Port 3000 déjà utilisé
```bash
# Trouver processus
lsof -i :3000

# Tuer
kill -9 <PID>

# Ou utiliser autre port
PORT=3001 npm start
```

### Sync WordPress échoue
```bash
# Vérifier logs
tail -f logs/sync.log

# Tester manuellement
curl -X POST http://localhost:3000/api/sync/product/650006a1b1b2b3b4b5b6b701 \
  -H "Content-Type: application/json" \
  -v  # Mode verbose pour voir erreur
```

---

## 📞 Support & Ressources

### Documentation
- **MongoDB**: https://docs.mongodb.com/
- **Express**: https://expressjs.com/
- **WooCommerce API**: https://woocommerce.com/document/rest-api/
- **Mongoose**: https://mongoosejs.com/

### Fournisseurs
- **Santé Bébé**: contact@santebebefrance.fr | +33 2 41 55 60 00
- **Bébé Distribution**: orders@bebedistribution.be | +32 2 722 40 88
- **Pedibaby**: ventas@pedibabyiberica.es | +34 931 123 456
- **Piccolini**: b2b@piccoliniitalia.it | +39 06 4588 0123

### Scripts utiles
```bash
npm run backup       # Sauvegarder MongoDB
npm run seed         # Recharger données
npm run update:prices  # Mettre à jour tarifs
npm run sync:wp      # Forcer sync WordPress
npm run pm2:start    # Lancer en production
npm run pm2:logs     # Voir logs PM2
```

---

## 📈 Feuille de route

### Phase 1 (Semaine 1-2): ✅ DONE
- [x] API MongoDB complète
- [x] 4 fournisseurs intégrés
- [x] Données produits initiaux
- [x] Synchronisation WordPress

### Phase 2 (Semaine 3-4): ⚠️ EN COURS
- [ ] Dashboard web (React/Vue)
- [ ] Panel admin WordPress custom
- [ ] Scraping prix fournisseurs
- [ ] Notifications automatiques

### Phase 3 (Mois 2): 🔄 PLANIFIÉ
- [ ] App mobile (React Native)
- [ ] IA tarification dynamique
- [ ] Intégration Shopify
- [ ] Multi-devises support

---

## 📄 Licences & Attributions

**Système complet créé pour marcherbien.fr**
- API: MIT License
- Données fournisseurs: Mise à jour 2024
- Guide: Creative Commons

---

## 🤝 Contribution

Pour améliorer le système:
1. Fork le repo
2. Créer branche feature (`git checkout -b feature/amazing`)
3. Commit (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing`)
5. Pull Request

---

## 💡 Questions Fréquentes

**Q: Puis-je utiliser avec d'autres fournisseurs?**
A: Oui! Structure est générique. Ajouter fournisseur = 3 endpoints.

**Q: Comment gérer TVA/taxes?**
A: Inclure dans `recommendedRetailPrice`. Ou ajouter champ `tax_rate` si besoin.

**Q: Peut-on synchroniser plusieurs sites WordPress?**
A: Oui, créer plusieurs entrées `WP_API_URL` dans .env ou base de données.

**Q: Quel est le volume minimal pour commencer?**
A: 1500-2000€ stock initial. Renouvellement hebdomadaire 500-1000€.

**Q: Combien de temps pour ROI?**
A: 45-60 jours selon volume ventes et taux de marge appliqué.

---

## 📝 Changelog

### v1.0.0 (Janvier 2024)
- Initial release
- 4 fournisseurs EU
- 10 produits base
- API complète
- WooCommerce sync

---

**Créé le:** 15 Janvier 2024  
**Dernière mise à jour:** 18 Janvier 2024  
**Version:** 1.0.0  
**Statut:** Production-Ready ✅

---

**🚀 Bon dropshipping! À bientôt sur marcherbien.fr!**
