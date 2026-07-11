// API DROPSHIPPING - Gestion MongoDB + Synchronisation WordPress
// Framework: Express.js
// Base de données: MongoDB

const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());

// ========== CONFIGURATION ==========
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/babyshop';
const WP_API_URL = process.env.WP_API_URL || 'https://marcherbien.fr/wp-json/wc/v3';
const WP_API_KEY = process.env.WP_API_KEY;
const WP_API_SECRET = process.env.WP_API_SECRET;

// ========== CONNEXION MONGODB ==========
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('✅ MongoDB connecté'))
  .catch(err => console.error('❌ Erreur MongoDB:', err));

// ========== SCHÉMAS MONGOOSE ==========

const SupplierSchema = new mongoose.Schema({
  name: String,
  country: String,
  website: String,
  email: String,
  phone: String,
  minOrderValue: Number,
  leadTime: {
    min: Number,
    max: Number,
    unit: String
  },
  shipping: {
    countries: [String],
    freeShippingAbove: Number,
    costPerKg: Number,
    estimatedDays: Number
  },
  paymentMethods: [String],
  supportedCurrencies: [String],
  catalogUrl: String,
  lastUpdated: Date,
  isActive: Boolean,
  rating: Number,
  reviews: Number
});

const ProductSchema = new mongoose.Schema({
  sku: { type: String, unique: true },
  name: String,
  slug: String,
  categoryId: mongoose.Schema.Types.ObjectId,
  brandId: mongoose.Schema.Types.ObjectId,
  description: String,
  ageRange: String,
  attributes: [{
    attributeId: mongoose.Schema.Types.ObjectId,
    valueId: mongoose.Schema.Types.ObjectId
  }],
  images: [String],
  isActive: Boolean,
  createdAt: Date
});

const ProductVariantSchema = new mongoose.Schema({
  productId: mongoose.Schema.Types.ObjectId,
  sku: { type: String, unique: true },
  name: String,
  attributes: [{
    name: String,
    value: String
  }],
  costPrice: Number,
  wholeSalePrice: Number,
  recommendedRetailPrice: Number,
  stock: Number
});

const SupplierProductSchema = new mongoose.Schema({
  supplierId: mongoose.Schema.Types.ObjectId,
  productId: mongoose.Schema.Types.ObjectId,
  supplierSku: String,
  supplierName: String,
  costPrice: Number,
  minOrder: Number,
  moq: Number,
  leadTime: {
    min: Number,
    max: Number,
    unit: String
  },
  packaging: {
    unit: String,
    quantity: Number
  },
  available: Boolean,
  lastUpdated: Date
});

const ProductMappingSchema = new mongoose.Schema({
  internalProductId: mongoose.Schema.Types.ObjectId,
  wpProductId: Number,
  wpSku: String,
  wpStatus: String,
  wpPrice: Number,
  wpStock: Number,
  syncedAt: Date,
  lastSyncStatus: String
});

// Modèles
const Supplier = mongoose.model('Supplier', SupplierSchema);
const Product = mongoose.model('Product', ProductSchema);
const ProductVariant = mongoose.model('ProductVariant', ProductVariantSchema);
const SupplierProduct = mongoose.model('SupplierProduct', SupplierProductSchema);
const ProductMapping = mongoose.model('ProductMapping', ProductMappingSchema);

// ========== ROUTES FOURNISSEURS ==========

// Récupérer tous les fournisseurs actifs
app.get('/api/suppliers', async (req, res) => {
  try {
    const suppliers = await Supplier.find({ isActive: true });
    res.json({
      success: true,
      count: suppliers.length,
      data: suppliers
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Récupérer fournisseur par ID
app.get('/api/suppliers/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Fournisseur non trouvé' });
    }
    res.json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Créer nouveau fournisseur
app.post('/api/suppliers', async (req, res) => {
  try {
    const supplier = new Supplier(req.body);
    await supplier.save();
    res.status(201).json({
      success: true,
      message: 'Fournisseur créé avec succès',
      data: supplier
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Mettre à jour fournisseur
app.put('/api/suppliers/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { ...req.body, lastUpdated: new Date() },
      { new: true }
    );
    res.json({
      success: true,
      message: 'Fournisseur mis à jour',
      data: supplier
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ========== ROUTES PRODUITS ==========

// Récupérer tous les produits
app.get('/api/products', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const products = await Product.find({ isActive: true })
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments({ isActive: true });

    res.json({
      success: true,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      },
      data: products
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Récupérer produit avec variantes et fournisseurs
app.get('/api/products/:id/details', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Produit non trouvé' });
    }

    const variants = await ProductVariant.find({ productId: req.params.id });
    const supplierProducts = await SupplierProduct.find({ productId: req.params.id })
      .populate('supplierId');

    res.json({
      success: true,
      data: {
        product,
        variants,
        suppliers: supplierProducts
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Créer produit
app.post('/api/products', async (req, res) => {
  try {
    const product = new Product({
      ...req.body,
      createdAt: new Date()
    });
    await product.save();
    res.status(201).json({
      success: true,
      message: 'Produit créé avec succès',
      data: product
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Créer variante de produit
app.post('/api/products/:productId/variants', async (req, res) => {
  try {
    const variant = new ProductVariant({
      productId: req.params.productId,
      ...req.body
    });
    await variant.save();
    res.status(201).json({
      success: true,
      message: 'Variante créée avec succès',
      data: variant
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ========== ROUTES FOURNISSEUR PRODUITS ==========

// Lister produits fournisseur
app.get('/api/supplier-products', async (req, res) => {
  try {
    const { supplierId, productId } = req.query;
    const filter = {};

    if (supplierId) filter.supplierId = supplierId;
    if (productId) filter.productId = productId;

    const supplierProducts = await SupplierProduct.find(filter)
      .populate('supplierId')
      .populate('productId');

    res.json({
      success: true,
      count: supplierProducts.length,
      data: supplierProducts
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ajouter produit fournisseur
app.post('/api/supplier-products', async (req, res) => {
  try {
    const supplierProduct = new SupplierProduct({
      ...req.body,
      lastUpdated: new Date()
    });
    await supplierProduct.save();
    res.status(201).json({
      success: true,
      message: 'Produit fournisseur ajouté',
      data: supplierProduct
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Mettre à jour prix/stock fournisseur
app.put('/api/supplier-products/:id', async (req, res) => {
  try {
    const supplierProduct = await SupplierProduct.findByIdAndUpdate(
      req.params.id,
      { ...req.body, lastUpdated: new Date() },
      { new: true }
    );
    res.json({
      success: true,
      message: 'Produit fournisseur mis à jour',
      data: supplierProduct
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ========== SYNCHRONISATION WORDPRESS ==========

// Fonction pour créer un produit WooCommerce
async function createWooProduct(product, variant) {
  try {
    const auth = Buffer.from(`${WP_API_KEY}:${WP_API_SECRET}`).toString('base64');

    const wpProduct = {
      name: product.name,
      description: product.description,
      sku: variant.sku,
      price: variant.recommendedRetailPrice.toString(),
      stock_quantity: variant.stock,
      status: 'publish',
      categories: [{ name: product.categoryName }],
      attributes: variant.attributes.map(attr => ({
        name: attr.name,
        options: [attr.value]
      })),
      images: product.images.map(img => ({ src: img }))
    };

    const response = await axios.post(
      `${WP_API_URL}/products`,
      wpProduct,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Erreur création WooCommerce:', error.response?.data || error.message);
    throw error;
  }
}

// Endpoint: Synchroniser produit vers WordPress
app.post('/api/sync/product/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    const variants = await ProductVariant.find({ productId: req.params.id });

    if (!product || variants.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Produit ou variantes non trouvés'
      });
    }

    const results = [];
    for (const variant of variants) {
      try {
        const wpProduct = await createWooProduct(product, variant);
        
        // Enregistrer le mapping
        const mapping = new ProductMapping({
          internalProductId: product._id,
          wpProductId: wpProduct.id,
          wpSku: variant.sku,
          wpStatus: wpProduct.status,
          wpPrice: wpProduct.price,
          wpStock: wpProduct.stock_quantity,
          syncedAt: new Date(),
          lastSyncStatus: 'success'
        });
        await mapping.save();
        
        results.push({
          variant: variant.name,
          wpId: wpProduct.id,
          status: 'success'
        });
      } catch (error) {
        results.push({
          variant: variant.name,
          status: 'error',
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Synchronisation complétée',
      results
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Mettre à jour stock WordPress
app.put('/api/sync/stock/:wpProductId', async (req, res) => {
  try {
    const { stock } = req.body;
    const auth = Buffer.from(`${WP_API_KEY}:${WP_API_SECRET}`).toString('base64');

    const response = await axios.put(
      `${WP_API_URL}/products/${req.params.wpProductId}`,
      { stock_quantity: stock },
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Mettre à jour le mapping
    await ProductMapping.findOneAndUpdate(
      { wpProductId: req.params.wpProductId },
      {
        wpStock: stock,
        syncedAt: new Date(),
        lastSyncStatus: 'success'
      }
    );

    res.json({
      success: true,
      message: 'Stock mis à jour sur WordPress'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Récupérer commandes WooCommerce
app.get('/api/orders/recent', async (req, res) => {
  try {
    const auth = Buffer.from(`${WP_API_KEY}:${WP_API_SECRET}`).toString('base64');
    const limit = req.query.limit || 50;

    const response = await axios.get(
      `${WP_API_URL}/orders?per_page=${limit}&orderby=date&order=desc`,
      {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      }
    );

    res.json({
      success: true,
      count: response.data.length,
      data: response.data.map(order => ({
        id: order.id,
        date: order.date_created,
        total: order.total,
        items: order.line_items,
        status: order.status
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== DASHBOARD & ANALYTICS ==========

// Vue d'ensemble du stock
app.get('/api/dashboard/inventory', async (req, res) => {
  try {
    const variants = await ProductVariant.find();
    
    const stats = {
      totalProducts: await Product.countDocuments(),
      totalVariants: variants.length,
      totalStock: variants.reduce((sum, v) => sum + v.stock, 0),
      totalValue: variants.reduce((sum, v) => sum + (v.stock * v.costPrice), 0),
      lowStockItems: await ProductVariant.find({ stock: { $lt: 5 } }).limit(10)
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analyser marge par fournisseur
app.get('/api/dashboard/supplier-margins/:supplierId', async (req, res) => {
  try {
    const supplierProducts = await SupplierProduct.find({
      supplierId: req.params.supplierId
    }).populate('productId');

    const analysis = supplierProducts.map(sp => {
      const costPrice = sp.costPrice;
      const baseMargin = ((sp.costPrice * 3) - sp.costPrice) / sp.costPrice * 100;
      
      return {
        product: sp.supplierName,
        costPrice,
        recommendedRetailPrice: costPrice * 3,
        marginPercent: baseMargin.toFixed(2)
      };
    });

    res.json({ success: true, data: analysis });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== SANTÉ DE L'API ==========

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date()
  });
});

// ========== DÉMARRAGE ==========

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 API Dropshipping lancée sur le port ${PORT}`);
  console.log(`📊 MongoDB: ${MONGODB_URI}`);
  console.log(`🌐 WooCommerce: ${WP_API_URL}`);
  console.log(`\nEndpoints disponibles:`);
  console.log(`   GET    /api/suppliers`);
  console.log(`   GET    /api/products`);
  console.log(`   GET    /api/products/:id/details`);
  console.log(`   GET    /api/supplier-products`);
  console.log(`   POST   /api/sync/product/:id`);
  console.log(`   GET    /api/dashboard/inventory`);
  console.log(`\n`);
});

module.exports = app;
