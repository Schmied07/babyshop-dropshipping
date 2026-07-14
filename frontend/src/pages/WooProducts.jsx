import { useState, useEffect } from "react";
import { Card } from "../components/Bits";
import {
  Package, ArrowsClockwise, LinkSimple, Pencil, Trash, ShoppingCart,
  TrendUp, Clock, CurrencyEur, Check, X, MagnifyingGlass, CaretUp, CaretDown
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
  
  // State for expanded variations
  const [expandedProducts, setExpandedProducts] = useState(new Set());
  
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

  const toggleExpand = (productId) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
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
      <div className="flex items-center justify-between mb-6 bg-gradient-to-r from-blue-600 to-blue-800 p-6 rounded-xl shadow-2xl border-2 border-blue-400">
        <div>
          <h1 className="text-4xl font-black text-white flex items-center gap-3 drop-shadow-lg">
            <div className="p-3 bg-white rounded-xl shadow-xl">
              <ShoppingCart size={36} weight="bold" className="text-blue-600" />
            </div>
            Produits Boutique WooCommerce
          </h1>
          <p className="text-white text-lg mt-3 font-bold drop-shadow">
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
            className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded text-sm font-medium flex items-center gap-2 shadow-lg"
          >
            <Check size={16} />
            Tester connexion
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-lg bg-blue-900/70 border-2 border-blue-400 shadow-xl mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Rechercher par nom ou SKU..."
                className="flex-1 px-4 py-3 bg-blue-800 border-2 border-blue-400 rounded-lg text-white text-sm placeholder-blue-200 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 font-medium"
              />
              <button
                onClick={handleSearch}
                className="px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg text-sm shadow-lg font-bold"
              >
                <MagnifyingGlass size={18} weight="bold" />
              </button>
            </div>
          </div>
          
          <div>
            <select
              value={filterFulfillment}
              onChange={(e) => setFilterFulfillment(e.target.value)}
              className="w-full px-4 py-3 bg-blue-800 border-2 border-blue-400 rounded-lg text-white text-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 font-medium"
            >
              <option value="" className="bg-blue-950">Tous types</option>
              <option value="dropshipping" className="bg-blue-950">Dropshipping</option>
              <option value="stock" className="bg-blue-950">Stock</option>
            </select>
          </div>
          
          <div>
            <select
              value={filterMapping}
              onChange={(e) => setFilterMapping(e.target.value)}
              className="w-full px-4 py-3 bg-blue-800 border-2 border-blue-400 rounded-lg text-white text-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 font-medium"
            >
              <option value="" className="bg-blue-950">Tous</option>
              <option value="mapped" className="bg-blue-950">Mappés</option>
              <option value="unmapped" className="bg-blue-950">Non mappés</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      {products.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0 shadow-lg">
            <div className="text-white text-sm font-semibold mb-1">Total produits</div>
            <div className="text-3xl font-bold text-white">{products.length}</div>
          </Card>
          <Card className="bg-gradient-to-br from-green-500 to-green-600 border-0 shadow-lg">
            <div className="text-white text-sm font-semibold mb-1">Mappés</div>
            <div className="text-3xl font-bold text-white">
              {products.filter(p => p.supplierProductId || (p.supplierMappings && p.supplierMappings.length > 0)).length}
            </div>
          </Card>
          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 border-0 shadow-lg">
            <div className="text-white text-sm font-semibold mb-1">Dropshipping</div>
            <div className="text-3xl font-bold text-white">
              {products.filter(p => p.fulfillmentType === "dropshipping").length}
            </div>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 border-0 shadow-lg">
            <div className="text-white text-sm font-semibold mb-1">Stock</div>
            <div className="text-3xl font-bold text-white">
              {products.filter(p => p.fulfillmentType === "stock").length}
            </div>
          </Card>
        </div>
      )}

      {/* Products Table */}
      <Card className="overflow-x-auto">
        {loading ? (
          <div className="text-center py-12 text-blue-400 font-medium">Chargement...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-block p-6 bg-blue-500/10 rounded-full mb-4">
              <Package size={48} className="text-blue-400" />
            </div>
            <p className="text-white font-medium mb-2 text-lg">
              Aucun produit trouvé
            </p>
            <p className="text-blue-300 mb-4">
              Cliquez sur "Synchroniser WooCommerce" pour importer vos produits.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
              <tr className="bg-gradient-to-r from-blue-600 to-blue-700">
                <th className="text-left p-3 text-white font-bold text-xs uppercase tracking-wide w-64">Produit</th>
                <th className="text-left p-3 text-white font-bold text-xs uppercase tracking-wide w-32">SKU</th>
                <th className="text-right p-3 text-white font-bold text-xs uppercase tracking-wide w-24">Prix</th>
                <th className="text-left p-3 text-white font-bold text-xs uppercase tracking-wide w-40">Fournisseur</th>
                <th className="text-center p-3 text-white font-bold text-xs uppercase tracking-wide w-24">Amazon</th>
                <th className="text-right p-3 text-white font-bold text-xs uppercase tracking-wide w-28">Marge</th>
                <th className="text-center p-3 text-white font-bold text-xs uppercase tracking-wide w-20">Stock</th>
                <th className="text-center p-3 text-white font-bold text-xs uppercase tracking-wide w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b-2 border-blue-700 hover:bg-blue-700/30 bg-blue-900/20">
                  {/* Produit */}
                  <td className="p-3 max-w-xs">
                    <div className="flex items-center gap-2">
                      {product.images && product.images.length > 0 && (
                        <img
                          src={product.images[0].src}
                          alt={product.name}
                          className="w-10 h-10 rounded-lg object-cover border-2 border-blue-500/30 flex-shrink-0 shadow"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div 
                          className="text-white! font-black text-lg leading-tight truncate drop-shadow-lg cursor-help" 
                          style={{color: 'white !important'}}
                          title={product.name || "Sans nom"}
                        >
                          {product.name || <span className="text-yellow-300! italic font-black text-lg" style={{color: '#fde047 !important'}}>Sans nom</span>}
                        </div>
                        {product.type === "variable" && (
                          <div className="text-blue-400 text-[10px] font-bold mt-0.5 bg-blue-500/10 px-1.5 py-0.5 rounded inline-block">
                            {product.variations?.length || 0} var.
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  
                  {/* SKU */}
                  <td className="p-3">
                    <div className="text-white! text-base font-mono font-black truncate bg-blue-700 px-3 py-2 rounded-lg inline-block border-2 border-blue-400 shadow-lg" style={{color: 'white !important'}}>
                      {product.sku || "-"}
                    </div>
                  </td>
                  
                  {/* Prix */}
                  <td className="p-3 text-right">
                    <div className="text-white! font-black text-2xl drop-shadow-lg" style={{color: 'white !important'}}>
                      {fmtEUR(parseFloat(product.price || 0))}
                    </div>
                  </td>
                  
                  {/* Fournisseur (simplifié) */}
                  <td className="p-3">
                    {product.supplierMappings && product.supplierMappings.length > 0 ? (
                      <div className="space-y-1">
                        {product.supplierMappings.slice(0, 2).map((mapping, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black shadow-lg ${
                              mapping.priority === 1
                                ? "bg-blue-600 text-white"
                                : "bg-orange-500 text-white"
                            }`} style={{color: 'white !important'}}>
                              {mapping.priority === 1 ? "★" : mapping.priority}
                            </span>
                            <span className="text-white text-xs font-black truncate" style={{color: 'white !important'}}>
                              {mapping.supplierName || "Fournisseur"}
                            </span>
                          </div>
                        ))}
                        {product.supplierMappings.length > 2 && (
                          <div className="text-white text-[9px] font-bold pl-5" style={{color: 'white !important'}}>
                            +{product.supplierMappings.length - 2}
                          </div>
                        )}
                      </div>
                    ) : product.supplierProduct ? (
                      <div className="text-[10px] text-white font-bold truncate" style={{color: 'white !important'}}>Mappé</div>
                    ) : (
                      <span className="text-yellow-300! text-base font-black" style={{color: '#fde047 !important'}}>Non mappé</span>
                    )}
                  </td>
                  
                  {/* Amazon (simplifié) */}
                  <td className="p-3 text-center">
                    {product.amazonData?.asin ? (
                      <div className="text-[10px]">
                        <div className="text-orange-400 font-mono font-bold bg-orange-500/10 px-1.5 py-0.5 rounded">{product.amazonData.asin}</div>
                        {product.amazonData.currentPrice && (
                          <div className="text-green-400 font-bold mt-0.5">{fmtEUR(product.amazonData.currentPrice)}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-blue-400 text-xs font-medium">-</span>
                    )}
                  </td>
                  
                  {/* Marge */}
                  <td className="p-3 text-right">
                    {product.calculatedMargin !== undefined ? (
                      <div className="text-[10px]">
                        <div className={`font-bold text-sm ${
                          product.calculatedMargin > 0 ? "text-green-400" : "text-red-400"
                        }`}>
                          {fmtEUR(product.calculatedMargin)}
                        </div>
                        <div className={`text-[10px] font-bold ${
                          product.calculatedMarginPct > 0 ? "text-green-400" : "text-red-400"
                        }`}>
                          {product.calculatedMarginPct?.toFixed(1)}%
                        </div>
                      </div>
                    ) : (
                      <span className="text-blue-400 text-xs font-medium">-</span>
                    )}
                  </td>
                  
                  {/* Stock */}
                  <td className="p-3 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-bold shadow ${
                      product.stock_status === "instock"
                        ? "bg-gradient-to-r from-green-500 to-green-600 text-white"
                        : "bg-gradient-to-r from-red-500 to-red-600 text-white"
                    }`}>
                      {product.stock_quantity || 0}
                    </span>
                  </td>
                  
                  {/* Actions */}
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => openMapModal(product)}
                        className="p-1.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg text-white shadow-lg transition"
                        title="Gérer"
                      >
                        <LinkSimple size={16} weight="bold" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
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

  const handleReorderSupplier = async (supplierProductId, newPriority, currentPriority) => {
    // Confirmation if changing to/from principal
    if (currentPriority === 1 || newPriority === 1) {
      if (!window.confirm(`Voulez-vous vraiment changer le fournisseur ${newPriority === 1 ? 'principal' : 'alternatif'} ?`)) {
        return;
      }
    }

    try {
      const response = await api.put(`/woocommerce/products/${product.id}/reorder-suppliers`, {
        supplier_product_id: supplierProductId,
        new_priority: newPriority,
        confirmed: true
      });

      if (response.data.confirmation_required) {
        if (window.confirm(response.data.message)) {
          await api.put(`/woocommerce/products/${product.id}/reorder-suppliers`, {
            supplier_product_id: supplierProductId,
            new_priority: newPriority,
            confirmed: true
          });
          toast.success("✅ Priorité modifiée !");
          onSuccess();
        }
      } else {
        toast.success(response.data.message);
        onSuccess();
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
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
                        className="flex items-center justify-between p-3 bg-zinc-800/50 border border-zinc-700 rounded hover:bg-zinc-800/70 transition"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <span className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow ${
                            mapping.priority === 1
                              ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-2 border-blue-300"
                              : "bg-gradient-to-r from-orange-500 to-orange-600 text-white border-2 border-orange-300"
                          }`}>
                            {mapping.priority === 1 ? "★ Principal" : `${mapping.priority}. Alternatif`}
                          </span>
                          <div className="flex-1">
                            <div className="text-white font-bold text-sm">{mapping.supplierName || "Fournisseur"}</div>
                            <div className="text-zinc-400 text-xs mt-0.5">{mapping.fulfillmentType === "dropshipping" ? "🚚 Dropshipping" : "📦 Stock"}</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {/* Move Up Button */}
                          {mapping.priority > 1 && (
                            <button
                              onClick={() => handleReorderSupplier(mapping.supplierProductId, mapping.priority - 1, mapping.priority)}
                              className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white shadow transition"
                              title="Monter la priorité"
                            >
                              <CaretUp size={16} weight="bold" />
                            </button>
                          )}
                          
                          {/* Move Down Button */}
                          {mapping.priority < existingMappings.length && (
                            <button
                              onClick={() => handleReorderSupplier(mapping.supplierProductId, mapping.priority + 1, mapping.priority)}
                              className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white shadow transition"
                              title="Descendre la priorité"
                            >
                              <CaretDown size={16} weight="bold" />
                            </button>
                          )}
                          
                          {/* Remove Button */}
                          <button
                            onClick={() => handleRemoveSupplier(mapping.supplierProductId)}
                            className="p-2 bg-red-600 hover:bg-red-700 rounded-lg text-white shadow transition"
                            title="Retirer ce fournisseur"
                          >
                            <X size={16} weight="bold" />
                          </button>
                        </div>
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
