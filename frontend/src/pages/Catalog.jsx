import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { downloadCSV } from "../lib/api";
import { fmtEUR, cn } from "../lib/format";
import { PageHeader, Card, StockBadge, StatusBadge, Loading } from "../components/Bits";
import {
  MagnifyingGlass, X, ArrowsClockwise, Package as PkgIcon, Lightning, Sparkle, Globe,
  CloudArrowUp, Robot, FileCsv, Buildings, CheckSquare, CaretDown,
} from "@phosphor-icons/react";

const CATEGORIES = ["Tous", "Hygiène", "Soins", "Bain", "Repas", "Déplacement"];

const TABS = [
  { key: "all", label: "Tous", testid: "tab-all" },
  { key: "imported", label: "Importés", testid: "tab-imported", desc: "Non publiés sur WooCommerce" },
  { key: "published", label: "Publiés", testid: "tab-published", desc: "Actifs sur marcherbien.fr" },
];

export default function Catalog() {
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState({ total: 0, published: 0, not_published: 0 });
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Tous");
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [checked, setChecked] = useState(new Set());
  const [stores, setStores] = useState([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    const params = { limit: 200 };
    if (q) params.q = q;
    if (cat !== "Tous") params.category = cat;
    if (tab !== "all") params.sync_status = tab;
    api.get("/products", { params }).then((r) => {
      setProducts(r.data.data || []);
      setChecked(new Set());
      setLoading(false);
    });
    api.get("/products/stats").then((r) => setStats(r.data));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [cat, tab]);
  useEffect(() => { api.get("/stores").then((r) => setStores(r.data.data || [])); }, []);

  const applyRules = async () => {
    toast.promise(api.post("/pricing-rules/apply-all").then(() => load()), {
      loading: "Application des règles…",
      success: "Prix recalculés",
      error: "Erreur",
    });
  };

  const toggle = (id) => {
    const next = new Set(checked);
    next.has(id) ? next.delete(id) : next.add(id);
    setChecked(next);
  };
  const toggleAll = () => {
    if (checked.size === products.length) setChecked(new Set());
    else setChecked(new Set(products.map((p) => p.id)));
  };

  const runBulkAI = async (action) => {
    setAiOpen(false);
    setBusy(true);
    try {
      const r = await api.post("/ai/bulk-action", { productIds: [...checked], action });
      if (!r.data.configured) {
        toast.error(r.data.message || "IA non configurée");
      } else {
        toast.success(`IA : ${r.data.updated} produit(s) mis à jour`);
        load();
      }
    } catch (e) {
      toast.error("Erreur IA : " + (e.response?.data?.detail || "erreur"));
    } finally {
      setBusy(false);
    }
  };

  const runBulkPublish = async (storeIds) => {
    setPublishOpen(false);
    setBusy(true);
    try {
      const r = await api.post("/woocommerce/bulk-publish", { productIds: [...checked], storeIds });
      toast.success(`Publication : ${r.data.published} réussie(s), ${r.data.failed} échec(s)`);
      load();
    } catch (e) {
      toast.error("Erreur publication : " + (e.response?.data?.detail || "erreur"));
    } finally {
      setBusy(false);
    }
  };

  const exportCSV = () => {
    downloadCSV("/export/products.csv", "produits.csv");
    toast.success("Export produits lancé");
  };

  return (
    <div className="p-8 lg:p-12 fade-up">
      <PageHeader
        title="Catalogue"
        subtitle={`${stats.total} produits · ${stats.published} publiés · ${stats.not_published} en attente`}
        action={
          <>
            <button className="btn btn-secondary" data-testid="export-products-btn" onClick={exportCSV}>
              <FileCsv size={14} weight="bold" /> Export CSV
            </button>
            <button className="btn btn-secondary" data-testid="apply-rules-btn" onClick={applyRules}>
              <Lightning size={14} weight="bold" /> Appliquer règles de prix
            </button>
          </>
        }
      />

      {/* Tabs like DSers */}
      <div className="flex items-center gap-0 mb-4 border-b border-border">
        {TABS.map((t) => {
          const count = t.key === "all" ? stats.total : t.key === "published" ? stats.published : stats.not_published;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-5 py-3 text-[13px] font-bold border-b-2 transition-colors",
                tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
              data-testid={t.testid}
            >
              {t.label}
              <span className={cn("ml-2 mono text-[11px] px-1.5 py-0.5", tab === t.key ? "bg-primary text-white" : "bg-muted")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-md min-w-[240px]">
          <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" weight="bold" />
          <input
            className="input pl-9"
            placeholder="Chercher un produit ou SKU…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            data-testid="catalog-search"
          />
        </div>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn("btn", cat === c ? "btn-primary" : "btn-secondary")}
            data-testid={`cat-filter-${c}`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Bulk action toolbar */}
      {checked.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-black text-white sticky top-16 z-20 fade-up" data-testid="bulk-toolbar">
          <CheckSquare size={18} weight="fill" className="text-white" />
          <span className="text-[13px] font-semibold">{checked.size} sélectionné(s)</span>
          <div className="flex-1" />
          <div className="relative">
            <button className="btn btn-secondary text-[12px]" onClick={() => setAiOpen((o) => !o)} disabled={busy} data-testid="bulk-ai-btn">
              <Robot size={14} weight="bold" /> Actions IA <CaretDown size={12} weight="bold" />
            </button>
            {aiOpen && (
              <div className="absolute right-0 mt-1 bg-white border border-border shadow-lg z-30 w-56 text-foreground" data-testid="bulk-ai-menu">
                <button className="w-full text-left px-4 py-2.5 text-[13px] hover:bg-muted flex items-center gap-2" onClick={() => runBulkAI("translate")} data-testid="bulk-ai-translate">
                  <Globe size={14} weight="bold" /> Traduire en FR
                </button>
                <button className="w-full text-left px-4 py-2.5 text-[13px] hover:bg-muted flex items-center gap-2" onClick={() => runBulkAI("seo")} data-testid="bulk-ai-seo">
                  <Sparkle size={14} weight="bold" /> Générer descriptions SEO
                </button>
                <button className="w-full text-left px-4 py-2.5 text-[13px] hover:bg-muted flex items-center gap-2" onClick={() => runBulkAI("both")} data-testid="bulk-ai-both">
                  <Lightning size={14} weight="bold" /> Traduire + SEO
                </button>
              </div>
            )}
          </div>
          <button className="btn btn-primary text-[12px]" onClick={() => setPublishOpen(true)} disabled={busy} data-testid="bulk-publish-btn">
            <CloudArrowUp size={14} weight="bold" /> Publier vers boutiques
          </button>
          <button className="text-white/70 hover:text-white p-1" onClick={() => setChecked(new Set())} data-testid="bulk-clear-btn" aria-label="Effacer">
            <X size={16} weight="bold" />
          </button>
        </div>
      )}

      {loading ? (
        <Loading />
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="data-table" data-testid="products-table">
              <thead>
                <tr>
                  <th className="w-10">
                    <input type="checkbox" checked={products.length > 0 && checked.size === products.length} onChange={toggleAll} data-testid="select-all-checkbox" />
                  </th>
                  <th>Produit</th>
                  <th>Catégorie</th>
                  <th className="num">Coût</th>
                  <th className="num">Prix vente</th>
                  <th className="num">Marge</th>
                  <th className="num">Stock</th>
                  <th>WooCommerce</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const margin = (p.retailPrice || 0) - (p.costPrice || 0);
                  const marginPct = p.retailPrice > 0 ? ((margin / p.retailPrice) * 100).toFixed(0) : 0;
                  return (
                    <tr key={p.id} className={checked.has(p.id) ? "bg-blue-50" : ""}>
                      <td>
                        <input type="checkbox" checked={checked.has(p.id)} onChange={() => toggle(p.id)} data-testid={`select-${p.sku}`} />
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          {p.images?.[0] ? (
                            <img src={p.images[0]} alt="" className="w-10 h-10 object-cover border border-border" />
                          ) : (
                            <div className="w-10 h-10 bg-muted flex items-center justify-center"><PkgIcon size={16} className="text-muted-foreground" /></div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-[13px]">{p.name}</div>
                            <div className="mono text-[11px] text-muted-foreground">{p.sku}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className="badge badge-neutral">{p.category || "—"}</span></td>
                      <td className="num">{fmtEUR(p.costPrice)}</td>
                      <td className="num font-bold">{fmtEUR(p.retailPrice)}</td>
                      <td className="num text-success">{fmtEUR(margin)} <span className="text-muted-foreground">({marginPct}%)</span></td>
                      <td className="num"><StockBadge stock={p.stock} /></td>
                      <td>
                        {p.wooSynced ? (
                          <div className="flex items-center gap-1">
                            <span className="badge badge-success">Publié</span>
                            {p.wpProductId && <span className="mono text-[10px] text-muted-foreground">#{p.wpProductId}</span>}
                          </div>
                        ) : (
                          <span className="badge badge-neutral">Non publié</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary text-[11px] py-1.5 px-2.5"
                          onClick={() => setSelected(p)}
                          data-testid={`product-detail-${p.sku}`}
                        >
                          Détails
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {products.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">Aucun produit dans cette vue.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {selected && <ProductDrawer product={selected} onClose={() => setSelected(null)} onChanged={load} />}
      {publishOpen && (
        <PublishModal
          count={checked.size}
          stores={stores}
          onClose={() => setPublishOpen(false)}
          onPublish={runBulkPublish}
        />
      )}
    </div>
  );
}

function PublishModal({ count, stores, onClose, onPublish }) {
  const [sel, setSel] = useState(new Set());
  const toggle = (id) => {
    const n = new Set(sel);
    n.has(id) ? n.delete(id) : n.add(id);
    setSel(n);
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" data-testid="publish-modal">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white border border-border fade-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="h3">Publier {count} produit(s)</div>
          <button className="p-2 hover:bg-muted" onClick={onClose}><X size={18} weight="bold" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="text-[12px] text-muted-foreground">
            Choisissez les boutiques cibles. Sans sélection, toutes vos boutiques actives seront utilisées.
          </div>
          {stores.length === 0 ? (
            <div className="text-[13px] p-3 border border-dashed border-border text-muted-foreground">
              Aucune boutique configurée. La boutique WooCommerce par défaut sera utilisée si disponible.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {stores.map((s) => (
                <label key={s.id} className={"flex items-center gap-3 p-3 border cursor-pointer " + (sel.has(s.id) ? "border-primary bg-blue-50" : "border-border hover:bg-muted")} data-testid={`publish-store-${s.id}`}>
                  <input type="checkbox" checked={sel.has(s.id)} onChange={() => toggle(s.id)} />
                  <Buildings size={16} weight="duotone" className="text-primary" />
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">{s.name}</div>
                    <div className="mono text-[10px] text-muted-foreground truncate">{s.url}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
          <button className="btn btn-primary w-full" onClick={() => onPublish([...sel])} data-testid="publish-confirm-btn">
            <CloudArrowUp size={14} weight="bold" /> {sel.size > 0 ? `Publier vers ${sel.size} boutique(s)` : "Publier vers toutes les boutiques"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductDrawer({ product, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [best, setBest] = useState(null);
  const [strategy, setStrategy] = useState("cheapest");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    api.get(`/products/${product.id}`).then((r) => setDetail(r.data));
  }, [product.id]);

  useEffect(() => {
    api.get(`/products/${product.id}/best-supplier`, { params: { strategy } }).then((r) => setBest(r.data.best));
  }, [product.id, strategy]);

  const syncWoo = () => {
    toast.promise(api.post(`/woocommerce/sync-product/${product.id}`).then((r) => {
      if (!r.data.success) throw new Error(r.data.error || "Erreur");
      onChanged();
    }), {
      loading: "Synchronisation WooCommerce…",
      success: (r) => "Synchronisé sur WooCommerce",
      error: (e) => "Erreur : " + (e.message || "sync"),
    });
  };

  const generateSEO = async () => {
    setAiLoading(true);
    try {
      const r = await api.post("/ai/seo-description", {
        productId: product.id,
        name: product.name,
        category: product.category || "",
        brand: product.brand || "",
      });
      toast.success("Description SEO générée par IA");
      const d = await api.get(`/products/${product.id}`);
      setDetail(d.data);
      onChanged();
    } catch (e) {
      toast.error("IA : " + (e.response?.data?.detail || "erreur"));
    } finally {
      setAiLoading(false);
    }
  };

  const translateName = async () => {
    setAiLoading(true);
    try {
      const r = await api.post("/ai/translate", { text: product.name, source_lang: "auto" });
      await api.put(`/products/${product.id}`, { name: r.data.translated });
      toast.success("Nom traduit en français");
      onChanged();
      onClose();
    } catch (e) {
      toast.error("IA : " + (e.response?.data?.detail || "erreur"));
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" data-testid="product-drawer">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white h-full overflow-y-auto border-l border-border fade-up">
        <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="h2">{product.name}</div>
            <div className="mono text-xs text-muted-foreground mt-1">{product.sku}</div>
          </div>
          <button className="p-2 hover:bg-muted" onClick={onClose} data-testid="drawer-close"><X size={18} weight="bold" /></button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <MetricBox label="Coût" value={fmtEUR(product.costPrice)} />
            <MetricBox label="Vente" value={fmtEUR(product.retailPrice)} />
            <MetricBox label="Stock" value={product.stock} />
          </div>

          {product.description && (
            <div className="text-sm text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: product.description.slice(0, 400) }} />
          )}

          {/* IA Actions */}
          <div className="border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkle size={16} weight="fill" className="text-primary" />
              <div className="h3">Assistant IA (DeepSeek)</div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button className="btn btn-secondary text-[12px]" onClick={translateName} disabled={aiLoading} data-testid="ai-translate">
                <Globe size={14} weight="bold" /> Traduire en FR
              </button>
              <button className="btn btn-secondary text-[12px]" onClick={generateSEO} disabled={aiLoading} data-testid="ai-seo">
                <Sparkle size={14} weight="bold" /> Description SEO
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="h3">Fournisseurs mappés</div>
              <div className="flex gap-1">
                {["cheapest", "fastest", "most_stock", "balanced"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStrategy(s)}
                    className={cn(
                      "text-[10px] mono uppercase tracking-widest px-2 py-1 border",
                      strategy === s ? "bg-black text-white border-black" : "border-border hover:bg-muted"
                    )}
                    data-testid={`strategy-${s}`}
                  >
                    {s === "cheapest" ? "Moins cher" : s === "fastest" ? "Rapide" : s === "most_stock" ? "Stock" : "Équilibré"}
                  </button>
                ))}
              </div>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fournisseur</th>
                    <th className="num">Coût</th>
                    <th className="num">Stock</th>
                    <th className="num">Délai</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(detail?.suppliers || []).map((sp) => (
                    <tr key={sp.id} className={best && sp.id === best.id ? "bg-blue-50" : ""}>
                      <td>
                        <div className="text-[13px] font-semibold">{sp.supplierNameFull}</div>
                        <div className="mono text-[10px] text-muted-foreground">{sp.supplierSku}</div>
                      </td>
                      <td className="num">{fmtEUR(sp.costPrice)}</td>
                      <td className="num"><StockBadge stock={sp.stock} /></td>
                      <td className="num">{sp.leadTime?.min}-{sp.leadTime?.max}j</td>
                      <td>
                        {best && sp.id === best.id && (
                          <span className="badge badge-primary">Optimal</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!detail?.suppliers || detail.suppliers.length === 0) && (
                    <tr><td colSpan={5} className="text-center text-muted-foreground py-6">Aucun fournisseur mappé.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="h3 mb-3 flex items-center gap-2"><CloudArrowUp size={18} weight="duotone" /> WooCommerce</div>
            {detail?.wooMapping ? (
              <div className="border border-border p-4 space-y-1 text-sm">
                <div>ID WP : <span className="mono">{detail.wooMapping.wpProductId}</span></div>
                <div>Statut : <StatusBadge status={detail.wooMapping.lastSyncStatus} /></div>
                <div>Dernière sync : {detail.wooMapping.syncedAt ? new Date(detail.wooMapping.syncedAt).toLocaleString("fr-FR") : "—"}</div>
                {detail.wooMapping.lastSyncError && <div className="text-critical text-xs">{detail.wooMapping.lastSyncError}</div>}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Non publié sur la boutique.</div>
            )}
            <button className="btn btn-primary mt-3" onClick={syncWoo} data-testid="sync-woo-btn">
              <ArrowsClockwise size={14} weight="bold" /> {detail?.wooMapping ? "Resynchroniser" : "Publier sur boutique"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, value }) {
  return (
    <div className="metric" style={{ padding: 14 }}>
      <div className="metric-label">{label}</div>
      <div className="mono font-bold text-xl mt-1">{value}</div>
    </div>
  );
}
