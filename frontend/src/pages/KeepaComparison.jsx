import { useState, useEffect } from "react";
import { Card, Loading } from "../components/Bits";
import { MagnifyingGlass, ArrowsClockwise, TrendUp, TrendDown, Package } from "@phosphor-icons/react";
import api from "../lib/api";
import { toast } from "sonner";
import { fmtEUR } from "../lib/format";

const EU_MARKETPLACES = [
  { value: "amazon.fr", label: "🇫🇷 France (amazon.fr)" },
  { value: "amazon.de", label: "🇩🇪 Allemagne (amazon.de)" },
  { value: "amazon.es", label: "🇪🇸 Espagne (amazon.es)" },
  { value: "amazon.it", label: "🇮🇹 Italie (amazon.it)" },
  { value: "amazon.nl", label: "🇳🇱 Pays-Bas (amazon.nl)" },
  { value: "amazon.be", label: "🇧🇪 Belgique (amazon.be)" },
  { value: "amazon.pl", label: "🇵🇱 Pologne (amazon.pl)" },
  { value: "amazon.se", label: "🇸🇪 Suède (amazon.se)" },
  { value: "amazon.uk", label: "🇬🇧 Royaume-Uni (amazon.uk)" },
];

export default function KeepaComparison() {
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [selectedMarketplace, setSelectedMarketplace] = useState("amazon.fr");
  const [cacheTTL, setCacheTTL] = useState(15);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState(null);
  const [sortField, setSortField] = useState("margin_pct");
  const [sortOrder, setSortOrder] = useState("desc");
  const [filters, setFilters] = useState({
    minMarginPct: "",
    minMarginEur: "",
    hasStock: false,
  });

  // Load suppliers
  useEffect(() => {
    api.get("/suppliers").then((r) => setSuppliers(r.data));
  }, []);

  const handleCompare = async () => {
    if (!selectedSupplier) {
      toast.error("Sélectionnez un fournisseur");
      return;
    }

    setLoading(true);
    try {
      const r = await api.post("/keepa/compare-supplier", {
        supplier_id: selectedSupplier,
        marketplace: selectedMarketplace,
        cache_ttl_minutes: cacheTTL,
      });

      setResults(r.data.results || []);
      setStats({
        supplier_name: r.data.supplier_name,
        total_products: r.data.total_products,
        compared_products: r.data.compared_products,
      });

      toast.success(`${r.data.compared_products} produits comparés avec Amazon`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erreur lors de la comparaison");
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort results
  const filteredResults = results
    .filter((item) => {
      if (filters.minMarginPct && item.margin_pct < parseFloat(filters.minMarginPct)) return false;
      if (filters.minMarginEur && item.margin_eur < parseFloat(filters.minMarginEur)) return false;
      if (filters.hasStock && item.stock <= 0) return false;
      return true;
    })
    .sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
    });

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  return (
    <div className="space-y-6" data-testid="keepa-comparison-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendUp size={28} weight="bold" />
            Comparaison Amazon (Keepa)
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Comparez vos prix fournisseurs avec les prix Amazon en temps réel
          </p>
        </div>
      </div>

      {/* Configuration Card */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              Fournisseur
            </label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
              data-testid="supplier-select"
            >
              <option value="">-- Sélectionner --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              Marketplace Amazon
            </label>
            <select
              value={selectedMarketplace}
              onChange={(e) => setSelectedMarketplace(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
              data-testid="marketplace-select"
            >
              {EU_MARKETPLACES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              Cache (minutes)
            </label>
            <input
              type="number"
              value={cacheTTL}
              onChange={(e) => setCacheTTL(parseInt(e.target.value) || 15)}
              min="1"
              max="120"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
              data-testid="cache-ttl-input"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleCompare}
              disabled={loading || !selectedSupplier}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded text-sm font-medium flex items-center justify-center gap-2"
              data-testid="compare-btn"
            >
              {loading ? (
                <>
                  <ArrowsClockwise className="animate-spin" size={16} />
                  Analyse...
                </>
              ) : (
                <>
                  <MagnifyingGlass size={16} />
                  Comparer
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filters */}
        {results.length > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-700">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  Marge min (%)
                </label>
                <input
                  type="number"
                  value={filters.minMarginPct}
                  onChange={(e) => setFilters({ ...filters, minMarginPct: e.target.value })}
                  placeholder="Ex: 20"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  Marge min (€)
                </label>
                <input
                  type="number"
                  value={filters.minMarginEur}
                  onChange={(e) => setFilters({ ...filters, minMarginEur: e.target.value })}
                  placeholder="Ex: 10"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white text-sm"
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.hasStock}
                    onChange={(e) => setFilters({ ...filters, hasStock: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-zinc-300">En stock uniquement</span>
                </label>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => setFilters({ minMarginPct: "", minMarginEur: "", hasStock: false })}
                  className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-sm"
                >
                  Réinitialiser filtres
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-blue-500/10 border-blue-500/30">
            <div className="text-xs text-zinc-400 mb-1">Fournisseur</div>
            <div className="text-lg font-bold text-blue-400">{stats.supplier_name}</div>
          </Card>
          <Card className="bg-green-500/10 border-green-500/30">
            <div className="text-xs text-zinc-400 mb-1">Produits comparés</div>
            <div className="text-lg font-bold text-green-400">
              {stats.compared_products} / {stats.total_products}
            </div>
          </Card>
          <Card className="bg-purple-500/10 border-purple-500/30">
            <div className="text-xs text-zinc-400 mb-1">Résultats filtrés</div>
            <div className="text-lg font-bold text-purple-400">{filteredResults.length}</div>
          </Card>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="text-left p-3 text-zinc-400 font-medium">Produit</th>
                <th className="text-left p-3 text-zinc-400 font-medium">EAN</th>
                <th
                  className="text-right p-3 text-zinc-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => toggleSort("supplier_price")}
                >
                  Prix Fournisseur {sortField === "supplier_price" && (sortOrder === "desc" ? "↓" : "↑")}
                </th>
                <th
                  className="text-right p-3 text-zinc-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => toggleSort("amazon_price")}
                >
                  Prix Amazon {sortField === "amazon_price" && (sortOrder === "desc" ? "↓" : "↑")}
                </th>
                <th
                  className="text-right p-3 text-zinc-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => toggleSort("buybox_price")}
                >
                  Buy Box {sortField === "buybox_price" && (sortOrder === "desc" ? "↓" : "↑")}
                </th>
                <th
                  className="text-right p-3 text-zinc-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => toggleSort("sales_rank")}
                >
                  Sales Rank {sortField === "sales_rank" && (sortOrder === "desc" ? "↓" : "↑")}
                </th>
                <th
                  className="text-right p-3 text-zinc-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => toggleSort("margin_eur")}
                >
                  Marge (€) {sortField === "margin_eur" && (sortOrder === "desc" ? "↓" : "↑")}
                </th>
                <th
                  className="text-right p-3 text-zinc-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => toggleSort("margin_pct")}
                >
                  Marge (%) {sortField === "margin_pct" && (sortOrder === "desc" ? "↓" : "↑")}
                </th>
                <th className="text-center p-3 text-zinc-400 font-medium">Offres</th>
                <th className="text-center p-3 text-zinc-400 font-medium">Stock</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.map((item) => {
                const marginPositive = item.margin_eur && item.margin_eur > 0;
                return (
                  <tr key={item.product_id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-12 h-12 rounded object-cover"
                          />
                        )}
                        <div>
                          <div className="text-white font-medium text-sm">{item.name}</div>
                          <div className="text-zinc-500 text-xs">{item.supplier_sku}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-zinc-400 text-xs font-mono">{item.ean}</td>
                    <td className="p-3 text-right text-white font-medium">
                      {fmtEUR(item.supplier_price)}
                    </td>
                    <td className="p-3 text-right text-white font-medium">
                      {item.amazon_price ? fmtEUR(item.amazon_price) : "-"}
                    </td>
                    <td className="p-3 text-right text-white font-medium">
                      {item.buybox_price ? fmtEUR(item.buybox_price) : "-"}
                    </td>
                    <td className="p-3 text-right text-zinc-400">
                      {item.sales_rank ? `#${item.sales_rank.toLocaleString()}` : "-"}
                    </td>
                    <td className="p-3 text-right">
                      {item.margin_eur !== null ? (
                        <span className={marginPositive ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                          {marginPositive && "+"}{fmtEUR(item.margin_eur)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {item.margin_pct !== null ? (
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                          marginPositive 
                            ? "bg-green-500/20 text-green-400 border border-green-500/30" 
                            : "bg-red-500/20 text-red-400 border border-red-500/30"
                        }`}>
                          {marginPositive && "+"}{item.margin_pct.toFixed(1)}%
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-3 text-center text-zinc-400">{item.offer_count || 0}</td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                        item.stock > 0
                          ? "bg-green-500/20 text-green-400 border border-green-500/30"
                          : "bg-red-500/20 text-red-400 border border-red-500/30"
                      }`}>
                        {item.stock}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredResults.length === 0 && (
            <div className="text-center py-12 text-zinc-500">
              <Package size={48} className="mx-auto mb-3 opacity-50" />
              <p>Aucun résultat ne correspond aux filtres</p>
            </div>
          )}
        </Card>
      )}

      {/* Empty state */}
      {results.length === 0 && !loading && (
        <Card className="text-center py-12">
          <TrendUp size={48} className="mx-auto mb-3 text-zinc-600" />
          <p className="text-zinc-400 mb-4">
            Sélectionnez un fournisseur et un marketplace pour commencer la comparaison
          </p>
          <p className="text-zinc-500 text-sm">
            Les prix Amazon seront récupérés via Keepa pour identifier les meilleures opportunités
          </p>
        </Card>
      )}
    </div>
  );
}
