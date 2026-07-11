// BABYSHOP DROPSHIPPING - MongoDB Seeding Script
// Script de création et remplissage des collections MongoDB
// Données réalistes de fournisseurs européens

// ========== 1. SUPPLIERS (Fournisseurs) ==========
db.suppliers.insertMany([
  {
    _id: ObjectId("650001a1b1b2b3b4b5b6b701"),
    name: "Santé Bébé France",
    country: "France",
    website: "www.santebebefrance.fr",
    email: "contact@santebebefrance.fr",
    phone: "+33 2 41 55 60 00",
    minOrderValue: 100,
    leadTime: { min: 3, max: 5, unit: "days" },
    shipping: {
      countries: ["FR", "BE", "LU", "DE", "NL", "ES", "IT"],
      freeShippingAbove: 500,
      costPerKg: 0.85,
      estimatedDays: 2
    },
    paymentMethods: ["SEPA", "Bank Transfer", "Card"],
    supportedCurrencies: ["EUR"],
    catalogUrl: "https://www.santebebefrance.fr/catalogue-professionnel",
    lastUpdated: new Date("2024-01-15"),
    isActive: true,
    rating: 4.7,
    reviews: 128
  },
  {
    _id: ObjectId("650001a1b1b2b3b4b5b6b702"),
    name: "Bébé Distribution Europe",
    country: "Belgium",
    website: "www.bebedistribution.be",
    email: "orders@bebedistribution.be",
    phone: "+32 2 722 40 88",
    minOrderValue: 150,
    leadTime: { min: 2, max: 4, unit: "days" },
    shipping: {
      countries: ["BE", "NL", "FR", "DE", "UK", "IT", "ES"],
      freeShippingAbove: 750,
      costPerKg: 0.95,
      estimatedDays: 1
    },
    paymentMethods: ["SEPA", "Bank Transfer", "Card"],
    supportedCurrencies: ["EUR"],
    catalogUrl: "https://www.bebedistribution.be/pro",
    lastUpdated: new Date("2024-01-18"),
    isActive: true,
    rating: 4.5,
    reviews: 94
  },
  {
    _id: ObjectId("650001a1b1b2b3b4b5b6b703"),
    name: "Pedibaby Ibérica",
    country: "Spain",
    website: "www.pedibabyiberica.es",
    email: "ventas@pedibabyiberica.es",
    phone: "+34 931 123 456",
    minOrderValue: 120,
    leadTime: { min: 4, max: 6, unit: "days" },
    shipping: {
      countries: ["ES", "PT", "FR", "IT"],
      freeShippingAbove: 600,
      costPerKg: 0.75,
      estimatedDays: 3
    },
    paymentMethods: ["SEPA", "Bank Transfer"],
    supportedCurrencies: ["EUR"],
    catalogUrl: "https://www.pedibabyiberica.es/catalogo",
    lastUpdated: new Date("2024-01-16"),
    isActive: true,
    rating: 4.6,
    reviews: 156
  },
  {
    _id: ObjectId("650001a1b1b2b3b4b5b6b704"),
    name: "Piccolini Italia",
    country: "Italy",
    website: "www.piccoliniitalia.it",
    email: "b2b@piccoliniitalia.it",
    phone: "+39 06 4588 0123",
    minOrderValue: 130,
    leadTime: { min: 3, max: 5, unit: "days" },
    shipping: {
      countries: ["IT", "FR", "DE", "AT", "CH"],
      freeShippingAbove: 700,
      costPerKg: 0.90,
      estimatedDays: 2
    },
    paymentMethods: ["SEPA", "Bank Transfer", "Card"],
    supportedCurrencies: ["EUR"],
    catalogUrl: "https://www.piccoliniitalia.it/catalogo-b2b",
    lastUpdated: new Date("2024-01-17"),
    isActive: true,
    rating: 4.4,
    reviews: 87
  }
]);

// ========== 2. BRANDS (Marques) ==========
db.brands.insertMany([
  {
    _id: ObjectId("650002a1b1b2b3b4b5b6b701"),
    name: "Laboratoires Saforelle",
    country: "France",
    category: "Hygiène & Soins",
    logo: "https://cdn.example.com/brands/saforelle.jpg",
    description: "Marque française spécialisée dans l'hygiène bébé depuis 1968",
    isActive: true
  },
  {
    _id: ObjectId("650002a1b1b2b3b4b5b6b702"),
    name: "Mustela",
    country: "France",
    category: "Soins",
    logo: "https://cdn.example.com/brands/mustela.jpg",
    description: "Laboratoire français des soins bébé et maman",
    isActive: true
  },
  {
    _id: ObjectId("650002a1b1b2b3b4b5b6b703"),
    name: "Medela",
    country: "Switzerland",
    category: "Allaitement",
    logo: "https://cdn.example.com/brands/medela.jpg",
    description: "Leader mondial en équipements d'allaitement",
    isActive: true
  },
  {
    _id: ObjectId("650002a1b1b2b3b4b5b6b704"),
    name: "LULA",
    country: "Germany",
    category: "Soin & Hygiène",
    logo: "https://cdn.example.com/brands/lula.jpg",
    description: "Produits de soin naturels pour bébés",
    isActive: true
  },
  {
    _id: ObjectId("650002a1b1b2b3b4b5b6b705"),
    name: "Bébé Confort",
    country: "France",
    category: "Accessoires",
    logo: "https://cdn.example.com/brands/bebeconfort.jpg",
    description: "Accessoires de puériculture et sacs à langer",
    isActive: true
  }
]);

// ========== 3. CATEGORIES ==========
db.categories.insertMany([
  {
    _id: ObjectId("650003a1b1b2b3b4b5b6b701"),
    name: "Hygiène",
    slug: "hygiene",
    description: "Produits d'hygiène pour bébé (0 à 3 ans)",
    ageRanges: ["0-3 mois", "3-6 mois", "6-12 mois", "1-3 ans"]
  },
  {
    _id: ObjectId("650003a1b1b2b3b4b5b6b702"),
    name: "Soins",
    slug: "soins",
    description: "Crèmes, huiles et produits de soin",
    ageRanges: ["0-3 mois", "3-6 mois", "6-12 mois", "1-3 ans"]
  },
  {
    _id: ObjectId("650003a1b1b2b3b4b5b6b703"),
    name: "Bain",
    slug: "bain",
    description: "Accessoires et produits pour le bain",
    ageRanges: ["0-3 mois", "3-6 mois", "6-12 mois", "1-3 ans"]
  },
  {
    _id: ObjectId("650003a1b1b2b3b4b5b6b704"),
    name: "Repas",
    slug: "repas",
    description: "Biberons et accessoires pour l'alimentation",
    ageRanges: ["0-3 mois", "3-6 mois", "6-12 mois", "1-3 ans"]
  },
  {
    _id: ObjectId("650003a1b1b2b3b4b5b6b705"),
    name: "Déplacement",
    slug: "deplacement",
    description: "Sacs et accessoires de transport",
    ageRanges: ["0-3 mois", "3-6 mois", "6-12 mois", "1-3 ans"]
  },
  {
    _id: ObjectId("650003a1b1b2b3b4b5b6b706"),
    name: "Kits",
    slug: "kits",
    description: "Kits regroupant plusieurs produits",
    ageRanges: ["0-3 mois", "3-6 mois", "6-12 mois", "1-3 ans"]
  }
]);

// ========== 4. ATTRIBUTES ==========
db.attributes.insertMany([
  {
    _id: ObjectId("650004a1b1b2b3b4b5b6b701"),
    name: "Tranche d'âge",
    type: "select",
    slug: "age-range"
  },
  {
    _id: ObjectId("650004a1b1b2b3b4b5b6b702"),
    name: "Contenance",
    type: "text",
    slug: "size"
  },
  {
    _id: ObjectId("650004a1b1b2b3b4b5b6b703"),
    name: "Matière",
    type: "select",
    slug: "material"
  },
  {
    _id: ObjectId("650004a1b1b2b3b4b5b6b704"),
    name: "Couleur",
    type: "select",
    slug: "color"
  },
  {
    _id: ObjectId("650004a1b1b2b3b4b5b6b705"),
    name: "Composition",
    type: "text",
    slug: "composition"
  }
]);

// ========== 5. ATTRIBUTE VALUES ==========
db.attributeValues.insertMany([
  // Âges
  { _id: ObjectId("650005a1b1b2b3b4b5b6b701"), attributeId: ObjectId("650004a1b1b2b3b4b5b6b701"), value: "0-3 mois" },
  { _id: ObjectId("650005a1b1b2b3b4b5b6b702"), attributeId: ObjectId("650004a1b1b2b3b4b5b6b701"), value: "3-6 mois" },
  { _id: ObjectId("650005a1b1b2b3b4b5b6b703"), attributeId: ObjectId("650004a1b1b2b3b4b5b6b701"), value: "6-12 mois" },
  { _id: ObjectId("650005a1b1b2b3b4b5b6b704"), attributeId: ObjectId("650004a1b1b2b3b4b5b6b701"), value: "1-3 ans" },
  
  // Matières
  { _id: ObjectId("650005a1b1b2b3b4b5b6b705"), attributeId: ObjectId("650004a1b1b2b3b4b5b6b703"), value: "Coton biologique" },
  { _id: ObjectId("650005a1b1b2b3b4b5b6b706"), attributeId: ObjectId("650004a1b1b2b3b4b5b6b703"), value: "Silicone médical" },
  { _id: ObjectId("650005a1b1b2b3b4b5b6b707"), attributeId: ObjectId("650004a1b1b2b3b4b5b6b703"), value: "Polyester" },
  { _id: ObjectId("650005a1b1b2b3b4b5b6b708"), attributeId: ObjectId("650004a1b1b2b3b4b5b6b703"), value: "Éponge naturelle" },
  
  // Couleurs
  { _id: ObjectId("650005a1b1b2b3b4b5b6b709"), attributeId: ObjectId("650004a1b1b2b3b4b5b6b704"), value: "Blanc" },
  { _id: ObjectId("650005a1b1b2b3b4b5b6b70a"), attributeId: ObjectId("650004a1b1b2b3b4b5b6b704"), value: "Rose" },
  { _id: ObjectId("650005a1b1b2b3b4b5b6b70b"), attributeId: ObjectId("650004a1b1b2b3b4b5b6b704"), value: "Bleu" },
  { _id: ObjectId("650005a1b1b2b3b4b5b6b70c"), attributeId: ObjectId("650004a1b1b2b3b4b5b6b704"), value: "Beige" }
]);

// ========== 6. PRODUCTS ==========
db.products.insertMany([
  // HYGIÈNE
  {
    _id: ObjectId("650006a1b1b2b3b4b5b6b701"),
    sku: "HYG-SERUM-0001",
    name: "Sérum physiologique stérile 120ml",
    slug: "serum-physiologique-120ml",
    categoryId: ObjectId("650003a1b1b2b3b4b5b6b701"),
    brandId: ObjectId("650002a1b1b2b3b4b5b6b701"),
    description: "Sérum physiologique stérile pour nettoyer les yeux et le nez du bébé",
    ageRange: "0-3 mois",
    attributes: [
      { attributeId: ObjectId("650004a1b1b2b3b4b5b6b702"), valueId: ObjectId("650005a1b1b2b3b4b5b6b701") }
    ],
    images: ["https://cdn.example.com/products/serum-phy.jpg"],
    isActive: true,
    createdAt: new Date()
  },
  {
    _id: ObjectId("650006a1b1b2b3b4b5b6b702"),
    sku: "HYG-COTON-0001",
    name: "Carrés de coton doux bio 100 unités",
    slug: "carres-coton-bio-100",
    categoryId: ObjectId("650003a1b1b2b3b4b5b6b701"),
    brandId: ObjectId("650002a1b1b2b3b4b5b6b701"),
    description: "Carrés de coton biologique ultra doux pour la peau sensible",
    ageRange: "0-3 mois",
    attributes: [
      { attributeId: ObjectId("650004a1b1b2b3b4b5b6b703"), valueId: ObjectId("650005a1b1b2b3b4b5b6b705") }
    ],
    images: ["https://cdn.example.com/products/coton.jpg"],
    isActive: true,
    createdAt: new Date()
  },
  {
    _id: ObjectId("650006a1b1b2b3b4b5b6b703"),
    sku: "HYG-LINGETTES-0001",
    name: "Lingettes nettoyantes pour bébé paquet 80",
    slug: "lingettes-nettoyantes-80",
    categoryId: ObjectId("650003a1b1b2b3b4b5b6b701"),
    brandId: ObjectId("650002a1b1b2b3b4b5b6b701"),
    description: "Lingettes sans alcool, hypoallergéniques",
    ageRange: "3-6 mois",
    images: ["https://cdn.example.com/products/lingettes.jpg"],
    isActive: true,
    createdAt: new Date()
  },

  // SOINS
  {
    _id: ObjectId("650006a1b1b2b3b4b5b6b704"),
    sku: "SOIN-CHANGE-0001",
    name: "Crème pour le change 100ml Mustela",
    slug: "creme-change-mustela-100ml",
    categoryId: ObjectId("650003a1b1b2b3b4b5b6b702"),
    brandId: ObjectId("650002a1b1b2b3b4b5b6b702"),
    description: "Crème protectrice pour le change - formule brevetée",
    ageRange: "0-3 mois",
    images: ["https://cdn.example.com/products/creme-change.jpg"],
    isActive: true,
    createdAt: new Date()
  },
  {
    _id: ObjectId("650006a1b1b2b3b4b5b6b705"),
    sku: "SOIN-HYDRA-0001",
    name: "Crème hydratante corps 100ml",
    slug: "creme-hydratante-100ml",
    categoryId: ObjectId("650003a1b1b2b3b4b5b6b702"),
    brandId: ObjectId("650002a1b1b2b3b4b5b6b702"),
    description: "Crème hydratante pour bébé à partir de 3 mois",
    ageRange: "3-6 mois",
    images: ["https://cdn.example.com/products/creme-hydra.jpg"],
    isActive: true,
    createdAt: new Date()
  },

  // BAIN
  {
    _id: ObjectId("650006a1b1b2b3b4b5b6b706"),
    sku: "BAIN-THERMO-0001",
    name: "Thermomètre de bain numérique",
    slug: "thermometre-bain-numerique",
    categoryId: ObjectId("650003a1b1b2b3b4b5b6b703"),
    brandId: ObjectId("650002a1b1b2b3b4b5b6b704"),
    description: "Thermomètre numérique avec alarme de température",
    ageRange: "0-3 mois",
    images: ["https://cdn.example.com/products/thermometre.jpg"],
    isActive: true,
    createdAt: new Date()
  },
  {
    _id: ObjectId("650006a1b1b2b3b4b5b6b707"),
    sku: "BAIN-CAPE-0001",
    name: "Cape de bain à capuche 100x100cm",
    slug: "cape-bain-capuche-100",
    categoryId: ObjectId("650003a1b1b2b3b4b5b6b703"),
    brandId: ObjectId("650002a1b1b2b3b4b5b6b705"),
    description: "Cape de bain douce et absorbante avec capuche",
    ageRange: "3-6 mois",
    attributes: [
      { attributeId: ObjectId("650004a1b1b2b3b4b5b6b703"), valueId: ObjectId("650005a1b1b2b3b4b5b6b705") }
    ],
    images: ["https://cdn.example.com/products/cape-bain.jpg"],
    isActive: true,
    createdAt: new Date()
  },

  // REPAS
  {
    _id: ObjectId("650006a1b1b2b3b4b5b6b708"),
    sku: "REPAS-BIBERONS-0001",
    name: "Lot de 2 biberons 240ml anti-coliques",
    slug: "biberons-240ml-anti-coliques",
    categoryId: ObjectId("650003a1b1b2b3b4b5b6b704"),
    brandId: ObjectId("650002a1b1b2b3b4b5b6b703"),
    description: "Biberons Medela avec système anti-coliques breveté",
    ageRange: "0-3 mois",
    images: ["https://cdn.example.com/products/biberons.jpg"],
    isActive: true,
    createdAt: new Date()
  },
  {
    _id: ObjectId("650006a1b1b2b3b4b5b6b709"),
    sku: "REPAS-CHAUFFE-0001",
    name: "Chauffe-biberon électrique 2 en 1",
    slug: "chauffe-biberon-electrique-2en1",
    categoryId: ObjectId("650003a1b1b2b3b4b5b6b704"),
    brandId: ObjectId("650002a1b1b2b3b4b5b6b703"),
    description: "Chauffe-biberon avec stérilisateur intégré",
    ageRange: "3-6 mois",
    images: ["https://cdn.example.com/products/chauffe-biberon.jpg"],
    isActive: true,
    createdAt: new Date()
  },

  // DÉPLACEMENT
  {
    _id: ObjectId("650006a1b1b2b3b4b5b6b70a"),
    sku: "DEPL-SACA-0001",
    name: "Sac à langer noir avec accessoires",
    slug: "sac-langer-noir-accessoires",
    categoryId: ObjectId("650003a1b1b2b3b4b5b6b705"),
    brandId: ObjectId("650002a1b1b2b3b4b5b6b705"),
    description: "Grand sac à langer avec compartiments isolants",
    ageRange: "0-3 mois",
    attributes: [
      { attributeId: ObjectId("650004a1b1b2b3b4b5b6b704"), valueId: ObjectId("650005a1b1b2b3b4b5b6b709") }
    ],
    images: ["https://cdn.example.com/products/sac-langer.jpg"],
    isActive: true,
    createdAt: new Date()
  },
  {
    _id: ObjectId("650006a1b1b2b3b4b5b6b70b"),
    sku: "DEPL-TAPIS-0001",
    name: "Tapis à langer imperméable 70x50cm",
    slug: "tapis-langer-impermeable",
    categoryId: ObjectId("650003a1b1b2b3b4b5b6b705"),
    brandId: ObjectId("650002a1b1b2b3b4b5b6b705"),
    description: "Tapis à langer portable avec motifs adorables",
    ageRange: "0-3 mois",
    images: ["https://cdn.example.com/products/tapis-langer.jpg"],
    isActive: true,
    createdAt: new Date()
  }
]);

// ========== 7. PRODUCT VARIANTS ==========
db.productVariants.insertMany([
  {
    _id: ObjectId("650007a1b1b2b3b4b5b6b701"),
    productId: ObjectId("650006a1b1b2b3b4b5b6b701"),
    sku: "HYG-SERUM-0001-PACK1",
    name: "Serum Physiologique - Pack x1",
    attributes: [{ name: "Packaging", value: "1 unité" }],
    costPrice: 0.45,
    wholeSalePrice: 0.65,
    recommendedRetailPrice: 1.99,
    stock: 150
  },
  {
    _id: ObjectId("650007a1b1b2b3b4b5b6b702"),
    productId: ObjectId("650006a1b1b2b3b4b5b6b701"),
    sku: "HYG-SERUM-0001-PACK5",
    name: "Serum Physiologique - Pack x5",
    attributes: [{ name: "Packaging", value: "5 unités" }],
    costPrice: 2.00,
    wholeSalePrice: 3.00,
    recommendedRetailPrice: 8.99,
    stock: 200
  },
  {
    _id: ObjectId("650007a1b1b2b3b4b5b6b703"),
    productId: ObjectId("650006a1b1b2b3b4b5b6b702"),
    sku: "HYG-COTON-0001-WHITE",
    name: "Coton Blanc",
    attributes: [{ name: "Couleur", value: "Blanc" }],
    costPrice: 0.90,
    wholeSalePrice: 1.35,
    recommendedRetailPrice: 3.99,
    stock: 300
  },
  {
    _id: ObjectId("650007a1b1b2b3b4b5b6b704"),
    productId: ObjectId("650006a1b1b2b3b4b5b6b708"),
    sku: "REPAS-BIBERONS-0001-240",
    name: "Biberons 240ml",
    attributes: [{ name: "Contenance", value: "240ml" }],
    costPrice: 8.50,
    wholeSalePrice: 12.75,
    recommendedRetailPrice: 29.99,
    stock: 75
  }
]);

// ========== 8. SUPPLIER PRODUCTS ==========
db.supplierProducts.insertMany([
  {
    _id: ObjectId("650008a1b1b2b3b4b5b6b701"),
    supplierId: ObjectId("650001a1b1b2b3b4b5b6b701"),
    productId: ObjectId("650006a1b1b2b3b4b5b6b701"),
    supplierSku: "SBF-SERUM-120",
    supplierName: "Sérum physiologique 120ml",
    costPrice: 0.45,
    minOrder: 10,
    moq: 10,
    leadTime: { min: 3, max: 5, unit: "days" },
    packaging: { unit: "Carton", quantity: 24 },
    available: true,
    lastUpdated: new Date()
  },
  {
    _id: ObjectId("650008a1b1b2b3b4b5b6b702"),
    supplierId: ObjectId("650001a1b1b2b3b4b5b6b701"),
    productId: ObjectId("650006a1b1b2b3b4b5b6b702"),
    supplierSku: "SBF-COTON-100",
    supplierName: "Carrés de coton 100 unités",
    costPrice: 0.90,
    minOrder: 5,
    moq: 5,
    leadTime: { min: 3, max: 5, unit: "days" },
    packaging: { unit: "Carton", quantity: 12 },
    available: true,
    lastUpdated: new Date()
  },
  {
    _id: ObjectId("650008a1b1b2b3b4b5b6b703"),
    supplierId: ObjectId("650002a1b1b2b3b4b5b6b702"),
    productId: ObjectId("650006a1b1b2b3b4b5b6b704"),
    supplierSku: "BDE-CREME-CHANGE-100",
    supplierName: "Crème pour le change 100ml",
    costPrice: 1.80,
    minOrder: 8,
    moq: 8,
    leadTime: { min: 2, max: 4, unit: "days" },
    packaging: { unit: "Carton", quantity: 20 },
    available: true,
    lastUpdated: new Date()
  },
  {
    _id: ObjectId("650008a1b1b2b3b4b5b6b704"),
    supplierId: ObjectId("650002a1b1b2b3b4b5b6b702"),
    productId: ObjectId("650006a1b1b2b3b4b5b6b706"),
    supplierSku: "BDE-THERMO-DIGIT",
    supplierName: "Thermomètre de bain numérique",
    costPrice: 3.20,
    minOrder: 6,
    moq: 6,
    leadTime: { min: 2, max: 4, unit: "days" },
    packaging: { unit: "Carton", quantity: 15 },
    available: true,
    lastUpdated: new Date()
  },
  {
    _id: ObjectId("650008a1b1b2b3b4b5b6b705"),
    supplierId: ObjectId("650001a1b1b2b3b4b5b6b701"),
    productId: ObjectId("650006a1b1b2b3b4b5b6b708"),
    supplierSku: "SBF-BIBERONS-240",
    supplierName: "Biberons 240ml lot de 2",
    costPrice: 8.50,
    minOrder: 4,
    moq: 4,
    leadTime: { min: 3, max: 5, unit: "days" },
    packaging: { unit: "Carton", quantity: 12 },
    available: true,
    lastUpdated: new Date()
  }
]);

// ========== 9. PRODUCT MAPPINGS ==========
db.productMappings.insertMany([
  {
    _id: ObjectId("650009a1b1b2b3b4b5b6b701"),
    internalProductId: ObjectId("650006a1b1b2b3b4b5b6b701"),
    wpProductId: 101,
    wpSku: "HYG-SERUM-0001",
    wpStatus: "publish",
    syncedAt: new Date()
  },
  {
    _id: ObjectId("650009a1b1b2b3b4b5b6b702"),
    internalProductId: ObjectId("650006a1b1b2b3b4b5b6b702"),
    wpProductId: 102,
    wpSku: "HYG-COTON-0001",
    wpStatus: "publish",
    syncedAt: new Date()
  },
  {
    _id: ObjectId("650009a1b1b2b3b4b5b6b703"),
    internalProductId: ObjectId("650006a1b1b2b3b4b5b6b704"),
    wpProductId: 103,
    wpSku: "SOIN-CHANGE-0001",
    wpStatus: "publish",
    syncedAt: new Date()
  }
]);

// ========== 10. SUPPLIER CATALOGS ==========
db.supplierCatalogs.insertMany([
  {
    _id: ObjectId("65000aa1b1b2b3b4b5b6b701"),
    supplierId: ObjectId("650001a1b1b2b3b4b5b6b701"),
    name: "Santé Bébé France - Catalogue 2024",
    catalogUrl: "https://www.santebebefrance.fr/catalogue-professionnel",
    catalogVersion: "2024-Q1",
    totalProducts: 450,
    categories: ["Hygiène", "Soins", "Bain", "Repas"],
    lastUpdated: new Date("2024-01-15"),
    publicationDate: new Date("2024-01-01")
  },
  {
    _id: ObjectId("65000aa1b1b2b3b4b5b6b702"),
    supplierId: ObjectId("650002a1b1b2b3b4b5b6b702"),
    name: "Bébé Distribution Europe - Catalogue 2024",
    catalogUrl: "https://www.bebedistribution.be/pro",
    catalogVersion: "2024-Q1",
    totalProducts: 380,
    categories: ["Hygiène", "Soins", "Bain", "Repas", "Accessoires"],
    lastUpdated: new Date("2024-01-18"),
    publicationDate: new Date("2024-01-05")
  }
]);

console.log("✅ MongoDB seeding completed successfully!");
console.log("📊 Statistics:");
console.log("   - Suppliers: 4");
console.log("   - Brands: 5");
console.log("   - Categories: 6");
console.log("   - Products: 10");
console.log("   - Product Variants: 4");
console.log("   - Supplier Products: 5");
