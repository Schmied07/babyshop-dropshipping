import { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { downloadCSV } from "../lib/api";
import { fmtEUR, cn } from "../lib/format";
import { PageHeader, Card, StockBadge, StatusBadge, Loading } from "../components/Bits";
import {
  MagnifyingGlass, X, ArrowsClockwise, Package as PkgIcon, Lightning, Sparkle, Globe,
  CloudArrowUp, Robot, FileCsv, Buildings, CheckSquare, CaretDown, Plus, Trash, PencilSimple,
} from "@phosphor-icons/react";

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
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [selectAllMatching, setSelectAllMatching] = useState(false);

  const load = () => {
    setLoading(true);
    const params = { limit: 200 };
    if (q) params.q = q;
    if (cat !== "Tous") params.category = cat;
    if (tab !== "all") params.sync_status = tab;
    api.get("/products", { params }).then((r) => {
      setProducts(r.data.data || []);
      setTotal(r.data.pagination?.total || 0);
      setChecked(new Set());
      setSelectAllMatching(false);
      setLoading(false);
    });
    api.get("/products/stats").then((r) => setStats(r.data));
    api.get("/products/categories").then((r) => setCategories(r.data.categories || []));
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
    setSelectAllMatching(false);
  };
  const toggleAll = () => {
    if (checked.size === products.length) { setChecked(new Set()); setSelectAllMatching(false); }
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

  const delProduct = async (p) => {
    if (!window.confirm(`Supprimer le produit "${p.name}" ?`)) return;
    try {
      await api.delete(`/products/${p.id}`);
      toast.success("Produit supprimé");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };

  const runBulkDelete = async () => {
    const n = selectAllMatching ? total : checked.size;
    if (!window.confirm(`Supprimer ${n} produit(s) ? Cette action est irréversible.`)) return;
    setBusy(true);
    try {
      const body = selectAllMatching
        ? {
            all: true,
            q: q || undefined,
            category: cat !== "Tous" ? cat : undefined,
            sync_status: tab !== "all" ? tab : undefined,
          }
        : { ids: [...checked] };
      const r = await api.post("/products/bulk-delete", body);
      toast.success(`${r.data.deleted} produit(s) supprimé(s)`);
      setChecked(new Set());
      setSelectAllMatching(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur lors de la suppression groupée");
    } finally {
      setBusy(false);
    }
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
            <button className="btn btn-primary" data-testid="add-product-btn" onClick={() => { setEditProduct(null); setShowForm(true); }}>
              <Plus size={14} weight="bold" /> Nouveau produit
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
        {["Tous", ...categories].map((c) => (
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
          <span className="text-[13px] font-semibold">{selectAllMatching ? total : checked.size} sélectionné(s)</span>
          {!selectAllMatching && checked.size === products.length && total > products.length && (
            <button
              className="text-[12px] underline text-white/90 hover:text-white"
              onClick={() => setSelectAllMatching(true)}
              data-testid="select-all-matching-btn"
            >
              Sélectionner les {total} produits du filtre
            </button>
          )}
          {selectAllMatching && (
            <button
              className="text-[12px] underline text-white/90 hover:text-white"
              onClick={() => { setSelectAllMatching(false); setChecked(new Set()); }}
              data-testid="clear-all-matching-btn"
            >
              Annuler la sélection
            </button>
          )}
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
          <button className="btn text-[12px] bg-critical text-white hover:opacity-90" onClick={runBulkDelete} disabled={busy} data-testid="bulk-delete-btn">
            <Trash size={14} weight="bold" /> Supprimer ({selectAllMatching ? total : checked.size})
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
                        <div className="flex items-center gap-1">
                          <button
                            className="btn btn-secondary text-[11px] py-1.5 px-2.5"
                            onClick={() => setSelected(p)}
                            data-testid={`product-detail-${p.sku}`}
                          >
                            Détails
                          </button>
                          <button
                            className="btn btn-ghost text-[11px] py-1.5 px-2"
                            onClick={() => { setEditProduct(p); setShowForm(true); }}
                            data-testid={`edit-product-${p.sku}`}
                            aria-label="Modifier"
                          >
                            <PencilSimple size={14} weight="bold" />
                          </button>
                          <button
                            className="btn btn-ghost text-[11px] py-1.5 px-2 text-critical"
                            onClick={() => delProduct(p)}
                            data-testid={`delete-product-${p.sku}`}
                            aria-label="Supprimer"
                          >
                            <Trash size={14} weight="bold" />
                          </button>
                        </div>
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
      {showForm && (
        <ProductFormModal
          product={editProduct}
          categories={categories}
          onClose={() => { setShowForm(false); setEditProduct(null); }}
          onSaved={() => { setShowForm(false); setEditProduct(null); load(); }}
        />
      )}
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
  const [suppliers, setSuppliers] = useState([]);
  const [supForm, setSupForm] = useState(null); // null = closed; object = editing/creating

  const reloadDetail = () => api.get(`/products/${product.id}`).then((r) => setDetail(r.data));

  useEffect(() => {
    reloadDetail();
    api.get("/suppliers").then((r) => setSuppliers(r.data.data || []));
    // eslint-disable-next-line
  }, [product.id]);

  const saveMapping = async () => {
    if (!supForm.supplierId || !supForm.supplierSku) return toast.error("Fournisseur et SKU requis");
    try {
      const payload = {
        supplierId: supForm.supplierId,
        productId: product.id,
        supplierSku: supForm.supplierSku,
        supplierName: supForm.supplierName || supForm.supplierSku,
        costPrice: Number(supForm.costPrice) || 0,
        stock: Number(supForm.stock) || 0,
      };
      if (supForm.id) await api.put(`/supplier-products/${supForm.id}`, payload);
      else await api.post("/supplier-products", payload);
      toast.success("Fournisseur enregistré");
      setSupForm(null);
      reloadDetail();
      onChanged();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };

  const delMapping = async (sp) => {
    if (!window.confirm("Retirer ce fournisseur du produit ?")) return;
    try {
      await api.delete(`/supplier-products/${sp.id}`);
      toast.success("Fournisseur retiré");
      reloadDetail();
      onChanged();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };

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
            <div className="mb-3">
              <button
                className="btn btn-secondary text-[12px]"
                onClick={() => setSupForm({ supplierId: "", supplierSku: "", supplierName: "", costPrice: 0, stock: 0 })}
                data-testid="add-mapping-btn"
              >
                <Plus size={13} weight="bold" /> Ajouter un fournisseur
              </button>
            </div>
            {supForm && (
              <div className="border border-border p-3 mb-3 grid grid-cols-2 gap-2" data-testid="mapping-form">
                <select className="input col-span-2" value={supForm.supplierId}
                  onChange={(e) => { const s = suppliers.find((x) => x.id === e.target.value); setSupForm({ ...supForm, supplierId: e.target.value, supplierName: s?.name || "" }); }}
                  data-testid="mapping-supplier-select">
                  <option value="">— Choisir un fournisseur —</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input className="input input-mono" placeholder="SKU fournisseur" value={supForm.supplierSku} onChange={(e) => setSupForm({ ...supForm, supplierSku: e.target.value })} data-testid="mapping-sku" />
                <input type="number" step="0.01" className="input input-mono" placeholder="Coût €" value={supForm.costPrice} onChange={(e) => setSupForm({ ...supForm, costPrice: e.target.value })} data-testid="mapping-cost" />
                <input type="number" className="input input-mono" placeholder="Stock" value={supForm.stock} onChange={(e) => setSupForm({ ...supForm, stock: e.target.value })} />
                <div className="col-span-2 flex justify-end gap-2">
                  <button className="btn btn-secondary text-[12px]" onClick={() => setSupForm(null)}>Annuler</button>
                  <button className="btn btn-primary text-[12px]" onClick={saveMapping} data-testid="mapping-save">Enregistrer</button>
                </div>
              </div>
            )}
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
                        <div className="flex items-center gap-1">
                          {best && sp.id === best.id && (
                            <span className="badge badge-primary">Optimal</span>
                          )}
                          <button className="p-1 hover:bg-muted" onClick={() => setSupForm({ id: sp.id, supplierId: sp.supplierId, supplierSku: sp.supplierSku, supplierName: sp.supplierNameFull, costPrice: sp.costPrice, stock: sp.stock })} data-testid={`edit-mapping-${sp.id}`} aria-label="Modifier">
                            <PencilSimple size={13} weight="bold" />
                          </button>
                          <button className="p-1 hover:bg-muted text-critical" onClick={() => delMapping(sp)} data-testid={`delete-mapping-${sp.id}`} aria-label="Retirer">
                            <Trash size={13} weight="bold" />
                          </button>
                        </div>
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

function ProductFormModal({ product, categories = [], onClose, onSaved }) {
  const isEdit = !!product?.id;
  const [form, setForm] = useState({
    sku: product?.sku || "",
    name: product?.name || "",
    category: product?.category || "",
    brand: product?.brand || "",
    description: product?.description || "",
    image: product?.images?.[0] || "",
    retailPrice: product?.retailPrice ?? 0,
    stock: product?.stock ?? 0,
    isActive: product?.isActive ?? true,
    priceLocked: product?.priceLocked ?? (Number(product?.retailPrice) > 0),
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm({ ...form, [k]: v });

  const submit = async () => {
    if (!form.sku || !form.name) return toast.error("SKU et nom requis");
    setSaving(true);
    const payload = {
      sku: form.sku, name: form.name,
      category: form.category || null, brand: form.brand || null,
      description: form.description || "",
      images: form.image ? [form.image] : [],
      retailPrice: Number(form.retailPrice) || 0,
      stock: Number(form.stock) || 0,
      isActive: form.isActive,
      priceLocked: form.priceLocked,
    };
    try {
      if (isEdit) {
        await api.put(`/products/${product.id}`, payload);
        toast.success("Produit mis à jour");
      } else {
        await api.post("/products", payload);
        toast.success("Produit créé");
      }
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur (SKU déjà existant ?)");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" data-testid="product-form-modal">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full max-w-xl max-h-[90vh] overflow-y-auto border border-border fade-up">
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="h2">{isEdit ? "Modifier le produit" : "Nouveau produit"}</div>
          <button className="p-2 hover:bg-muted" onClick={onClose}><X size={18} weight="bold" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">SKU</label>
              <input className="input input-mono" value={form.sku} onChange={(e) => set("sku", e.target.value)} data-testid="product-sku" disabled={isEdit} />
            </div>
            <div>
              <label className="label">Catégorie</label>
              <input
                className="input"
                list="product-categories-list"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                placeholder="Saisir ou choisir…"
                data-testid="product-category"
              />
              <datalist id="product-categories-list">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>
          <div>
            <label className="label">Nom</label>
            <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} data-testid="product-name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Marque</label>
              <input className="input" value={form.brand} onChange={(e) => set("brand", e.target.value)} />
            </div>
            <div>
              <label className="label">Image (URL)</label>
              <input className="input input-mono" value={form.image} onChange={(e) => set("image", e.target.value)} placeholder="https://…" />
            </div>
            <div>
              <label className="label">Prix de vente (€)</label>
              <input type="number" step="0.01" className="input input-mono" value={form.retailPrice} onChange={(e) => setForm({ ...form, retailPrice: e.target.value, priceLocked: true })} data-testid="product-price" />
            </div>
            <div>
              <label className="label">Stock</label>
              <input type="number" className="input input-mono" value={form.stock} onChange={(e) => set("stock", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} />
            Produit actif
          </label>
          <label className="flex items-center gap-2 text-sm" data-testid="product-price-locked-label">
            <input type="checkbox" checked={form.priceLocked} onChange={(e) => set("priceLocked", e.target.checked)} data-testid="product-price-locked" />
            Verrouiller ce prix (ignorer le pricing automatique)
          </label>
          {isEdit && <div className="text-[11px] text-muted-foreground">Astuce : le prix est recalculé par les règles si des fournisseurs sont mappés (onglet Détails).</div>}
        </div>
        <div className="border-t border-border px-6 py-4 flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving} data-testid="product-form-submit">
            {saving ? "Enregistrement…" : (isEdit ? "Enregistrer" : "Créer")}
          </button>
        </div>
      </div>
    </div>
  );
}
