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
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShoppingCart size={28} weight="bold" />
            Produits Boutique WooCommerce
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Gérez vos produits WooCommerce et mappez-les aux fournisseurs
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white rounded text-sm font-medium flex items-center gap-2"
          data-testid="sync-btn"
        >
          <ArrowsClockwise size={16} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Synchronisation..." : "Synchroniser WooCommerce"}
        </button>
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
              <tr className="border-b border-zinc-700">
                <th className="text-left p-3 text-zinc-400 font-medium">Produit</th>
                <th className="text-left p-3 text-zinc-400 font-medium">SKU</th>
                <th className="text-right p-3 text-zinc-400 font-medium">Prix vente</th>
                <th className="text-left p-3 text-zinc-400 font-medium">Fournisseur</th>
                <th className="text-right p-3 text-zinc-400 font-medium">Marge</th>
                <th className="text-center p-3 text-zinc-400 font-medium">Type</th>
                <th className="text-center p-3 text-zinc-400 font-medium">Délai</th>
                <th className="text-center p-3 text-zinc-400 font-medium">Stock</th>
                <th className="text-center p-3 text-zinc-400 font-medium">Actions</th>
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
                          className="w-12 h-12 rounded object-cover"
                        />
                      )}
                      <div>
                        <div className="text-white font-medium text-sm">{product.name}</div>
                        <div className="text-zinc-500 text-xs">
                          {product.type === "variable" && `${product.variations?.length || 0} variations`}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-zinc-400 text-xs font-mono">{product.sku || "-"}</td>
                  <td className="p-3 text-right text-white font-medium">
                    {fmtEUR(parseFloat(product.price || 0))}
                  </td>
                  <td className="p-3">
                    {product.supplierProduct ? (
                      <div className="text-xs">
                        <div className="text-white font-medium">{product.supplierProduct.name}</div>
                        <div className="text-zinc-500">
                          Coût: {fmtEUR(product.supplierProduct.costPrice)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-zinc-500 text-xs">Non mappé</span>
                    )}
                  </td>
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
                  <td className="p-3 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                      product.fulfillmentType === "dropshipping"
                        ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                        : "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                    }`}>
                      {product.fulfillmentType === "dropshipping" ? "Dropship" : "Stock"}
                    </span>
                  </td>
                  <td className="p-3 text-center text-zinc-400 text-xs">
                    {product.supplierProduct?.leadTimeDays 
                      ? `${product.supplierProduct.leadTimeDays}j` 
                      : "-"}
                  </td>
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
                    <div className="flex items-center justify-center gap-2">
                      {product.supplierProductId ? (
                        <>
                          <button
                            onClick={() => handleUnmap(product.id)}
                            className="p-1 hover:bg-zinc-700 rounded text-red-400"
                            title="Retirer mapping"
                          >
                            <X size={16} weight="bold" />
                          </button>
                          <button
                            onClick={() => openEditModal(product)}
                            className="p-1 hover:bg-zinc-700 rounded text-blue-400"
                            title="Modifier"
                          >
                            <Pencil size={16} weight="bold" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => openMapModal(product)}
                          className="p-1 hover:bg-zinc-700 rounded text-green-400"
                          title="Mapper fournisseur"
                        >
                          <LinkSimple size={16} weight="bold" />
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

// Map Supplier Modal Component
function MapSupplierModal({ product, onClose, onSuccess }) {
  const [suppliers, setSuppliers] = useState([]);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState("dropshipping");
  const [marginMode, setMarginMode] = useState("auto");
  const [targetMargin, setTargetMargin] = useState("");
  const [extraCosts, setExtraCosts] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/suppliers").then((r) => setSuppliers(r.data.data || []));
  }, []);

  useEffect(() => {
    if (selectedSupplier) {
      api.get(`/supplier-products?supplierId=${selectedSupplier}`)
        .then((r) => setSupplierProducts(r.data.data || []));
    }
  }, [selectedSupplier]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) {
      toast.error("Sélectionnez un produit fournisseur");
      return;
    }

    setSaving(true);
    try {
      await api.post(`/woocommerce/products/${product.id}/map-supplier`, {
        supplier_product_id: selectedProduct,
        fulfillment_type: fulfillmentType,
        margin_mode: marginMode,
        target_margin_pct: marginMode === "manual" ? parseFloat(targetMargin) : null,
        extra_costs: parseFloat(extraCosts) || 0,
      });
      toast.success("Mapping créé avec succès !");
      onSuccess();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-zinc-800">
          <h2 className="text-xl font-bold text-white">Mapper au fournisseur</h2>
          <p className="text-sm text-zinc-400 mt-1">{product.name}</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Fournisseur</label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              required
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
            >
              <option value="">-- Sélectionner --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {selectedSupplier && (
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Produit fournisseur</label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                required
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
              >
                <option value="">-- Sélectionner --</option>
                {supplierProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} - {fmtEUR(p.costPrice)} (Stock: {p.stock})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Type de gestion</label>
            <select
              value={fulfillmentType}
              onChange={(e) => setFulfillmentType(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
            >
              <option value="dropshipping">Dropshipping (envoi direct fournisseur)</option>
              <option value="stock">Stock (achat puis réexpédition)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Mode de marge</label>
            <select
              value={marginMode}
              onChange={(e) => setMarginMode(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
            >
              <option value="auto">Automatique (calcul depuis prix WooCommerce)</option>
              <option value="manual">Manuel (définir marge cible → calcul prix vente)</option>
            </select>
          </div>

          {marginMode === "manual" && (
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Marge cible (%)</label>
              <input
                type="number"
                value={targetMargin}
                onChange={(e) => setTargetMargin(e.target.value)}
                min="0"
                max="100"
                step="0.1"
                placeholder="Ex: 30"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Frais supplémentaires (€)
            </label>
            <input
              type="number"
              value={extraCosts}
              onChange={(e) => setExtraCosts(e.target.value)}
              min="0"
              step="0.01"
              placeholder="Stockage, réexpédition..."
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white"
            />
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
              {saving ? "Enregistrement..." : "Mapper"}
            </button>
          </div>
        </form>
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
