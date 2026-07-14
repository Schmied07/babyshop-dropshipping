import { useState, useEffect } from "react";
import { Card } from "../components/Bits";
import {
  Package, ArrowsClockwise, LinkSimple, Pencil, Trash, ShoppingCart,
  TrendUp, Clock, CurrencyEur, Check, X, MagnifyingGlass
} from "@phosphor-icons/react";
import api from "../lib/api";
import { toast } from "sonner";
import { fmtEUR } from "../lib/format";

export default function WooProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [filterFulfillment, setFilterFulfillment] = useState("");
  const [filterMapping, setFilterMapping] = useState("");
  
  const [showMapModal, setShowMapModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  // Load products
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (filterFulfillment) params.fulfillment_type = filterFulfillment;
      if (filterMapping === "mapped") params.has_mapping = true;
      if (filterMapping === "unmapped") params.has_mapping = false;
      
      const r = await api.get("/woocommerce/products", { params });
      setProducts(r.data.data || []);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = await api.post("/woocommerce/products/sync");
      toast.success(`✅ Synchronisation réussie ! ${r.data.total} produits`);
      loadProducts();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur de synchronisation");
    } finally {
      setSyncing(false);
    }
  };

  const handleSearch = () => {
    loadProducts();
  };

  const openMapModal = (product) => {
    setSelectedProduct(product);
    setShowMapModal(true);
  };

  const openEditModal = (product) => {
    setSelectedProduct(product);
    setShowEditModal(true);
  };

  const handleUnmap = async (productId) => {
    if (!window.confirm("Retirer le mapping fournisseur ?")) return;
    try {
      await api.delete(`/woocommerce/products/${productId}/unmap-supplier`);
      toast.success("Mapping supprimé");
      loadProducts();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };

  return (
    <div className="space-y-6" data-testid="woo-products-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ShoppingCart size={32} weight="bold" className="text-blue-400" />
            Produits Boutique WooCommerce
          </h1>
          <p className="text-zinc-300 text-base mt-2">
            Gérez vos produits WooCommerce et mappez-les aux fournisseurs
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white rounded text-sm font-medium flex items-center gap-2"
            data-testid="sync-btn"
          >
            <ArrowsClockwise size={16} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Synchronisation..." : "Synchroniser WooCommerce"}
          </button>
          <button
            onClick={async () => {
              try {
                const r = await api.post("/woocommerce/products/test-connection");
                if (r.data.success) {
                  toast.success(r.data.message);
                } else {
                  toast.error(r.data.message || r.data.error);
                }
              } catch (e) {
                toast.error(e.response?.data?.detail || "Erreur de test");
              }
            }}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-sm font-medium flex items-center gap-2"
          >
            <Check size={16} />
            Tester connexion
          </button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Rechercher par nom ou SKU..."
                className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-sm"
              >
                <MagnifyingGlass size={16} />
              </button>
            </div>
          </div>
          
          <div>
            <select
              value={filterFulfillment}
              onChange={(e) => setFilterFulfillment(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
            >
              <option value="">Tous types</option>
              <option value="dropshipping">Dropshipping</option>
              <option value="stock">Stock</option>
            </select>
          </div>
          
          <div>
            <select
              value={filterMapping}
              onChange={(e) => setFilterMapping(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
            >
              <option value="">Tous</option>
              <option value="mapped">Mappés</option>
              <option value="unmapped">Non mappés</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Stats */}
      {products.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-blue-500/10 border-blue-500/30">
            <div className="text-xs text-zinc-400 mb-1">Total produits</div>
            <div className="text-2xl font-bold text-blue-400">{products.length}</div>
          </Card>
          <Card className="bg-green-500/10 border-green-500/30">
            <div className="text-xs text-zinc-400 mb-1">Mappés</div>
            <div className="text-2xl font-bold text-green-400">
              {products.filter(p => p.supplierProductId).length}
            </div>
          </Card>
          <Card className="bg-orange-500/10 border-orange-500/30">
            <div className="text-xs text-zinc-400 mb-1">Dropshipping</div>
            <div className="text-2xl font-bold text-orange-400">
              {products.filter(p => p.fulfillmentType === "dropshipping").length}
            </div>
          </Card>
          <Card className="bg-purple-500/10 border-purple-500/30">
            <div className="text-xs text-zinc-400 mb-1">Stock</div>
            <div className="text-2xl font-bold text-purple-400">
              {products.filter(p => p.fulfillmentType === "stock").length}
            </div>
          </Card>
        </div>
      )}

      {/* Products Table */}
      <Card className="overflow-x-auto">
        {loading ? (
          <div className="text-center py-12 text-zinc-500">Chargement...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <Package size={48} className="mx-auto mb-3 text-zinc-600" />
            <p className="text-zinc-400 mb-4">
              Aucun produit. Cliquez sur "Synchroniser WooCommerce" pour importer vos produits.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700 bg-zinc-800/50">
                <th className="text-left p-3 text-zinc-200 font-bold text-xs uppercase tracking-wide">Produit</th>
                <th className="text-left p-3 text-zinc-200 font-bold text-xs uppercase tracking-wide">SKU</th>
                <th className="text-right p-3 text-zinc-200 font-bold text-xs uppercase tracking-wide">Prix vente</th>
                <th className="text-left p-3 text-zinc-200 font-bold text-xs uppercase tracking-wide">Fournisseurs</th>
                <th className="text-left p-3 text-zinc-200 font-bold text-xs uppercase tracking-wide">Amazon</th>
                <th className="text-right p-3 text-zinc-200 font-bold text-xs uppercase tracking-wide">Marge</th>
                <th className="text-center p-3 text-zinc-200 font-bold text-xs uppercase tracking-wide">Type</th>
                <th className="text-center p-3 text-zinc-200 font-bold text-xs uppercase tracking-wide">Stock</th>
                <th className="text-center p-3 text-zinc-200 font-bold text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      {product.images && product.images.length > 0 && (
                        <img
                          src={product.images[0].src}
                          alt={product.name}
                          className="w-12 h-12 rounded object-cover border border-zinc-700"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-semibold text-sm leading-tight truncate">
                          {product.name || <span className="text-zinc-500 italic">Sans nom</span>}
                        </div>
                        {product.type === "variable" && (
                          <div className="text-blue-400 text-xs font-medium mt-1">
                            {product.variations?.length || 0} variation{product.variations?.length > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-zinc-300 text-xs font-mono font-semibold">{product.sku || "-"}</td>
                  <td className="p-3 text-right text-white font-medium">
                    {fmtEUR(parseFloat(product.price || 0))}
                  </td>
                  
                  {/* Fournisseurs (multiples) */}
                  <td className="p-3">
                    {product.supplierMappings && product.supplierMappings.length > 0 ? (
                      <div className="space-y-1">
                        {product.supplierMappings.slice(0, 2).map((mapping, idx) => (
                          <div key={idx} className="text-xs flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              mapping.priority === 1 
                                ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                                : "bg-zinc-700 text-zinc-400"
                            }`}>
                              {mapping.priority === 1 ? "Principal" : `Alt. ${mapping.priority - 1}`}
                            </span>
                            <span className="text-zinc-300 truncate text-[11px]">
                              {mapping.supplierName || "Fournisseur"}
                            </span>
                          </div>
                        ))}
                        {product.supplierMappings.length > 2 && (
                          <div className="text-[10px] text-zinc-500 font-medium">
                            +{product.supplierMappings.length - 2} autre(s)
                          </div>
                        )}
                      </div>
                    ) : product.supplierProduct ? (
                      <div className="text-xs">
                        <div className="text-white font-semibold text-[11px]">{product.supplierProduct.name}</div>
                        <div className="text-zinc-400 font-medium mt-0.5 text-[10px]">
                          Coût: {fmtEUR(product.supplierProduct.costPrice)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-zinc-500 text-xs font-medium">Non mappé</span>
                    )}
                  </td>
                  
                  {/* Amazon */}
                  <td className="p-3">
                    {product.amazonData?.asin ? (
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-zinc-500 font-mono">ASIN:</span>
                          <span className="text-[10px] text-blue-400 font-mono font-semibold">{product.amazonData.asin}</span>
                        </div>
                        {product.amazonData.currentPrice && (
                          <div className="text-zinc-300 font-medium text-[11px]">
                            Amazon: {fmtEUR(product.amazonData.currentPrice)}
                          </div>
                        )}
                        {product.amazonMargin !== null && product.amazonMargin !== undefined && (
                          <div className={`font-semibold text-[10px] ${
                            product.amazonMargin > 0 ? "text-green-400" : "text-red-400"
                          }`}>
                            Marge: {fmtEUR(product.amazonMargin)} ({product.amazonMarginPct?.toFixed(1)}%)
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-zinc-500 text-xs">-</span>
                    )}
                  </td>
                  
                  {/* Marge fournisseur */}
                  <td className="p-3 text-right">
                    {product.calculatedMargin !== undefined ? (
                      <div className="text-xs">
                        <div className={`font-semibold ${
                          product.calculatedMargin > 0 ? "text-green-400" : "text-red-400"
                        }`}>
                          {fmtEUR(product.calculatedMargin)}
                        </div>
                        <div className={`${
                          product.calculatedMarginPct > 0 ? "text-green-400" : "text-red-400"
                        }`}>
                          {product.calculatedMarginPct?.toFixed(1)}%
                        </div>
                      </div>
                    ) : (
                      <span className="text-zinc-500 text-xs">-</span>
                    )}
                  </td>
                  
                  {/* Type */}
                  <td className="p-3 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                      product.fulfillmentType === "dropshipping"
                        ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                        : "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                    }`}>
                      {product.fulfillmentType === "dropshipping" ? "Dropship" : "Stock"}
                    </span>
                  </td>
                  
                  {/* Stock */}
                  <td className="p-3 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                      product.stock_status === "instock"
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : "bg-red-500/20 text-red-400 border border-red-500/30"
                    }`}>
                      {product.stock_quantity || 0}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => openMapModal(product)}
                        className="p-1.5 hover:bg-zinc-700 rounded text-green-400"
                        title="Gérer fournisseurs & Amazon"
                      >
                        <LinkSimple size={18} weight="bold" />
                      </button>
                      {(product.supplierProductId || (product.supplierMappings && product.supplierMappings.length > 0)) && (
                        <button
                          onClick={() => openEditModal(product)}
                          className="p-1.5 hover:bg-zinc-700 rounded text-blue-400"
                          title="Modifier produit"
                        >
                          <Pencil size={18} weight="bold" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Map Modal */}
      {showMapModal && (
        <MapSupplierModal
          product={selectedProduct}
          onClose={() => {
            setShowMapModal(false);
            setSelectedProduct(null);
          }}
          onSuccess={() => {
            setShowMapModal(false);
            setSelectedProduct(null);
            loadProducts();
          }}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <EditProductModal
          product={selectedProduct}
          onClose={() => {
            setShowEditModal(false);
            setSelectedProduct(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedProduct(null);
            loadProducts();
          }}
        />
      )}
    </div>
  );
}

// Map Supplier Modal Component - Enhanced for Multiple Suppliers + Amazon
function MapSupplierModal({ product, onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState("suppliers"); // "suppliers" | "amazon"
  
  // Suppliers tab states
  const [suppliers, setSuppliers] = useState([]);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState("dropshipping");
  const [marginMode, setMarginMode] = useState("auto");
  const [targetMargin, setTargetMargin] = useState("");
  const [extraCosts, setExtraCosts] = useState("0");
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Amazon tab states
  const [asin, setAsin] = useState(product.amazonData?.asin || "");
  const [marketplace, setMarketplace] = useState(product.amazonData?.marketplace || "fr");
  const [amazonComparison, setAmazonComparison] = useState(null);
  const [loadingComparison, setLoadingComparison] = useState(false);

  useEffect(() => {
    api.get("/suppliers").then((r) => setSuppliers(r.data.data || []));
  }, []);

  useEffect(() => {
    if (selectedSupplier) {
      api.get(`/supplier-products?supplierId=${selectedSupplier}`)
        .then((r) => {
          const products = r.data.data || [];
          setSupplierProducts(products);
          setFilteredProducts(products);
        });
    }
  }, [selectedSupplier]);

  useEffect(() => {
    if (!searchQuery) {
      setFilteredProducts(supplierProducts);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = supplierProducts.filter(p => 
        p.name?.toLowerCase().includes(query) ||
        p.supplierSku?.toLowerCase().includes(query) ||
        p.ean?.toLowerCase().includes(query)
      );
      setFilteredProducts(filtered);
    }
  }, [searchQuery, supplierProducts]);

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    if (!selectedProduct) {
      toast.error("Sélectionnez un produit fournisseur");
      return;
    }

    setSaving(true);
    try {
      await api.post(`/woocommerce/products/${product.id}/add-supplier-mapping`, {
        supplier_product_id: selectedProduct,
        fulfillment_type: fulfillmentType,
        margin_mode: marginMode,
        target_margin_pct: marginMode === "manual" ? parseFloat(targetMargin) : null,
        extra_costs: parseFloat(extraCosts) || 0,
      });
      toast.success("✅ Fournisseur ajouté !");
      setShowAddForm(false);
      setSelectedSupplier("");
      setSelectedProduct("");
      onSuccess();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveSupplier = async (supplierProductId) => {
    if (!window.confirm("Retirer ce fournisseur ?")) return;
    try {
      await api.delete(`/woocommerce/products/${product.id}/remove-supplier-mapping/${supplierProductId}`);
      toast.success("Fournisseur retiré");
      onSuccess();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };

  const handleSetAsin = async () => {
    if (!asin || asin.length !== 10) {
      toast.error("ASIN invalide (10 caractères requis)");
      return;
    }

    setSaving(true);
    try {
      await api.post(`/woocommerce/products/${product.id}/set-asin`, { asin, marketplace });
      toast.success("✅ ASIN enregistré !");
      onSuccess();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleCompareAmazon = async () => {
    if (!product.amazonData?.asin) {
      toast.error("Configurez d'abord l'ASIN");
      return;
    }

    setLoadingComparison(true);
    try {
      const r = await api.get(`/woocommerce/products/${product.id}/amazon-comparison`);
      setAmazonComparison(r.data);
      toast.success("✅ Comparaison Amazon récupérée");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur Keepa");
    } finally {
      setLoadingComparison(false);
    }
  };

  const existingMappings = product.supplierMappings || [];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto border border-zinc-700">
        {/* Header */}
        <div className="p-6 border-b border-zinc-700 bg-zinc-800/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <LinkSimple size={24} weight="bold" className="text-blue-400" />
            Gérer Fournisseurs & Amazon
          </h2>
          <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded">
            <div className="text-sm font-medium text-blue-400">Produit WooCommerce :</div>
            <div className="text-white font-semibold">{product.name || "Sans nom"}</div>
            {product.sku && <div className="text-xs text-zinc-400">SKU: {product.sku}</div>}
            <div className="text-xs text-zinc-300 mt-1">Prix vente : {fmtEUR(parseFloat(product.price || 0))}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-700">
          <button
            onClick={() => setActiveTab("suppliers")}
            className={`flex-1 px-6 py-3 text-sm font-semibold transition ${
              activeTab === "suppliers"
                ? "bg-zinc-800 text-white border-b-2 border-blue-500"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            🚚 Fournisseurs ({existingMappings.length})
          </button>
          <button
            onClick={() => setActiveTab("amazon")}
            className={`flex-1 px-6 py-3 text-sm font-semibold transition ${
              activeTab === "amazon"
                ? "bg-zinc-800 text-white border-b-2 border-blue-500"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            📦 Amazon / Keepa
          </button>
        </div>

        <div className="p-6">
          {/* Suppliers Tab */}
          {activeTab === "suppliers" && (
            <div className="space-y-5">
              {/* Existing Mappings */}
              {existingMappings.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-white mb-3">Fournisseurs mappés :</h3>
                  <div className="space-y-2">
                    {existingMappings.map((mapping, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-zinc-800/50 border border-zinc-700 rounded"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            mapping.priority === 1
                              ? "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                              : "bg-zinc-700 text-zinc-300"
                          }`}>
                            {mapping.priority === 1 ? "Principal" : `Alternatif ${mapping.priority - 1}`}
                          </span>
                          <div>
                            <div className="text-white font-semibold text-sm">{mapping.supplierName || "Fournisseur"}</div>
                            <div className="text-zinc-400 text-xs">{mapping.fulfillmentType === "dropshipping" ? "Dropshipping" : "Stock"}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveSupplier(mapping.supplierProductId)}
                          className="p-1.5 hover:bg-zinc-700 rounded text-red-400"
                          title="Retirer"
                        >
                          <X size={18} weight="bold" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Supplier Button */}
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded font-medium text-sm"
                >
                  + Ajouter un fournisseur {existingMappings.length > 0 ? "alternatif" : ""}
                </button>
              )}

              {/* Add Supplier Form */}
              {showAddForm && (
                <form onSubmit={handleAddSupplier} className="space-y-4 p-4 bg-zinc-800/30 border border-zinc-700 rounded">
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">Sélectionner le fournisseur</label>
                    <select
                      value={selectedSupplier}
                      onChange={(e) => {
                        setSelectedSupplier(e.target.value);
                        setSelectedProduct("");
                        setSearchQuery("");
                      }}
                      required
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-white"
                    >
                      <option value="">-- Choisir --</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {selectedSupplier && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-white mb-2">Rechercher le produit</label>
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Nom, SKU ou EAN..."
                          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-white text-sm"
                        />
                        <div className="text-xs text-zinc-400 mt-1">{filteredProducts.length} produit(s)</div>
                      </div>

                      <div className="max-h-48 overflow-y-auto border border-zinc-700 rounded">
                        {filteredProducts.length === 0 ? (
                          <div className="p-4 text-center text-zinc-500 text-sm">Aucun produit</div>
                        ) : (
                          filteredProducts.slice(0, 20).map((p) => (
                            <label
                              key={p.id}
                              className={`flex items-center gap-2 p-2 cursor-pointer hover:bg-zinc-800/50 border-b border-zinc-800 last:border-0 ${
                                selectedProduct === p.id ? "bg-blue-500/20" : ""
                              }`}
                            >
                              <input
                                type="radio"
                                name="supplierProduct"
                                value={p.id}
                                checked={selectedProduct === p.id}
                                onChange={() => setSelectedProduct(p.id)}
                                className="w-4 h-4"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-white text-xs font-medium truncate">{p.name}</div>
                                <div className="text-zinc-400 text-[10px]">
                                  {p.supplierSku && <span>SKU: {p.supplierSku} • </span>}
                                  <span className="font-semibold text-green-400">{fmtEUR(p.costPrice)}</span>
                                </div>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </>
                  )}

                  {selectedProduct && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-white mb-1">Type</label>
                        <select
                          value={fulfillmentType}
                          onChange={(e) => setFulfillmentType(e.target.value)}
                          className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-600 rounded text-white text-xs"
                        >
                          <option value="dropshipping">Dropshipping</option>
                          <option value="stock">Stock</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-white mb-1">Mode marge</label>
                        <select
                          value={marginMode}
                          onChange={(e) => setMarginMode(e.target.value)}
                          className="w-full px-2 py-1.5 bg-zinc-800 border border-zinc-600 rounded text-white text-xs"
                        >
                          <option value="auto">Auto</option>
                          <option value="manual">Manuel</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="flex-1 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-sm"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={saving || !selectedProduct}
                      className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white rounded text-sm font-medium"
                    >
                      {saving ? "⏳ Ajout..." : "✅ Ajouter"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Amazon Tab */}
          {activeTab === "amazon" && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-white mb-2">ASIN Amazon</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={asin}
                    onChange={(e) => setAsin(e.target.value.toUpperCase())}
                    placeholder="Ex: B08N5WRWNW"
                    maxLength={10}
                    className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-white font-mono text-sm"
                  />
                  <select
                    value={marketplace}
                    onChange={(e) => setMarketplace(e.target.value)}
                    className="px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-white text-sm"
                  >
                    <option value="fr">🇫🇷 France</option>
                    <option value="de">🇩🇪 Allemagne</option>
                    <option value="it">🇮🇹 Italie</option>
                    <option value="es">🇪🇸 Espagne</option>
                    <option value="uk">🇬🇧 UK</option>
                  </select>
                  <button
                    onClick={handleSetAsin}
                    disabled={saving || !asin}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white rounded text-sm font-medium"
                  >
                    {saving ? "..." : "Sauvegarder"}
                  </button>
                </div>
                <div className="text-xs text-zinc-400 mt-1">10 caractères alphanumériques</div>
              </div>

              {product.amazonData?.asin && (
                <>
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded">
                    <div className="text-xs text-green-400 font-medium">✅ ASIN configuré : {product.amazonData.asin}</div>
                  </div>

                  <button
                    onClick={handleCompareAmazon}
                    disabled={loadingComparison}
                    className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-zinc-700 text-white rounded font-medium text-sm"
                  >
                    {loadingComparison ? "⏳ Chargement Keepa..." : "🔍 Comparer avec Amazon (Keepa)"}
                  </button>

                  {amazonComparison && (
                    <div className="p-4 bg-zinc-800/50 border border-zinc-700 rounded space-y-2">
                      <div className="text-sm font-bold text-white">Résultat de comparaison :</div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-zinc-400">Prix Amazon actuel</div>
                          <div className="text-white font-bold">{fmtEUR(amazonComparison.amazonPrice)}</div>
                        </div>
                        <div>
                          <div className="text-zinc-400">Votre prix</div>
                          <div className="text-white font-bold">{fmtEUR(amazonComparison.yourPrice)}</div>
                        </div>
                        <div>
                          <div className="text-zinc-400">Coût fournisseur</div>
                          <div className="text-white font-bold">{fmtEUR(amazonComparison.supplierCost)}</div>
                        </div>
                        <div>
                          <div className="text-zinc-400">Marge si aligné Amazon</div>
                          <div className={`font-bold ${amazonComparison.amazonMargin > 0 ? "text-green-400" : "text-red-400"}`}>
                            {fmtEUR(amazonComparison.amazonMargin)} ({amazonComparison.amazonMarginPct?.toFixed(1)}%)
                          </div>
                        </div>
                      </div>
                      {amazonComparison.salesRank && (
                        <div className="text-xs text-zinc-400 mt-2">
                          Sales Rank: #{amazonComparison.salesRank.toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-700 bg-zinc-800/30">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded font-medium"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// Edit Product Modal Component (simplified - to be expanded)
function EditProductModal({ product, onClose, onSuccess }) {
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(product.regular_price);
  const [stock, setStock] = useState(product.stock_quantity || 0);
  const [syncToWoo, setSyncToWoo] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/woocommerce/products/${product.id}`, {
        name,
        regular_price: price,
        stock_quantity: parseInt(stock),
        sync_to_woo: syncToWoo,
      });
      toast.success(syncToWoo ? "Produit mis à jour et synchronisé !" : "Produit mis à jour localement");
      onSuccess();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-lg max-w-lg w-full">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-xl font-bold text-white">Modifier le produit</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Nom</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Prix (€)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              min="0"
              step="0.01"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Stock</label>
            <input
              type="number"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              min="0"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={syncToWoo}
              onChange={(e) => setSyncToWoo(e.target.checked)}
              id="sync-checkbox"
              className="rounded"
            />
            <label htmlFor="sync-checkbox" className="text-sm text-zinc-300">
              Synchroniser vers WooCommerce
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white rounded font-medium"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
