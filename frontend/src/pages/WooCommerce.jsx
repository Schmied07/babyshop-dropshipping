import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import { PageHeader, Card, Loading, StatusBadge } from "../components/Bits";
import { fmtDate, fmtEUR } from "../lib/format";
import { ArrowsClockwise, CheckCircle, XCircle, Package, PlugsConnected } from "@phosphor-icons/react";

export default function WooCommerce() {
  const [status, setStatus] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(null);
  const [bulkSyncing, setBulkSyncing] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/woocommerce/status"),
      api.get("/products", { params: { limit: 200 } }),
    ]).then(async ([s, p]) => {
      setStatus(s.data);
      const prods = p.data.data || [];
      // Enrich with mapping info
      const enriched = await Promise.all(prods.map(async (pr) => {
        try {
          const d = await api.get(`/products/${pr.id}`);
          return { ...pr, wooMapping: d.data.wooMapping };
        } catch { return pr; }
      }));
      setProducts(enriched);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const syncOne = async (id) => {
    setSyncing(id);
    try {
      const r = await api.post(`/woocommerce/sync-product/${id}`);
      if (r.data.success) toast.success(r.data.mocked ? "Synchronisé (mode simulé)" : "Synchronisé sur WooCommerce");
      else toast.error("Erreur : " + (r.data.error || ""));
      load();
    } finally { setSyncing(null); }
  };

  const syncAll = async () => {
    setBulkSyncing(true);
    try {
      const r = await api.post("/woocommerce/sync-all");
      toast.success(`Synchronisation : ${r.data.success}/${r.data.total} réussis`);
      load();
    } finally { setBulkSyncing(false); }
  };

  return (
    <div className="p-8 lg:p-12 fade-up">
      <PageHeader
        title="Synchronisation WooCommerce"
        subtitle="marcherbien.fr — Publiez produits, stocks et prix"
        action={
          <button className="btn btn-primary" onClick={syncAll} disabled={bulkSyncing} data-testid="sync-all-btn">
            <ArrowsClockwise size={14} weight="bold" className={bulkSyncing ? "animate-spin" : ""} />
            {bulkSyncing ? "Synchronisation…" : "Tout synchroniser"}
          </button>
        }
      />

      {/* Connection status */}
      <Card className="mb-6">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 flex items-center justify-center ${status?.configured && status?.reachable ? "bg-success" : status?.configured ? "bg-warning" : "bg-critical"}`}>
              <PlugsConnected size={24} weight="fill" color="#fff" />
            </div>
            <div>
              <div className="h3">Connexion WooCommerce</div>
              <div className="text-sm text-muted-foreground mt-1 mono">
                {status?.configured ? (status.reachable ? "✓ API joignable — clés valides" : `⚠ Non joignable (HTTP ${status.status_code || "?"})`) : "Non configuré"}
              </div>
              {status?.error && <div className="text-xs text-critical mt-1">{status.error}</div>}
            </div>
          </div>
          <div className="mono text-[11px] text-muted-foreground uppercase tracking-widest">
            marcherbien.fr
          </div>
        </div>
      </Card>

      {loading ? <Loading /> : (
        <Card title="Produits">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th className="num">Prix</th>
                  <th className="num">Stock</th>
                  <th>WP ID</th>
                  <th>Statut sync</th>
                  <th>Dernière sync</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="text-[13px] font-semibold">{p.name}</div>
                      <div className="mono text-[11px] text-muted-foreground">{p.sku}</div>
                    </td>
                    <td className="num font-bold">{fmtEUR(p.retailPrice)}</td>
                    <td className="num">{p.stock}</td>
                    <td className="mono text-[11px]">{p.wooMapping?.wpProductId || "—"}</td>
                    <td>{p.wooMapping ? <StatusBadge status={p.wooMapping.lastSyncStatus} /> : <span className="badge badge-neutral">Non sync</span>}</td>
                    <td className="text-xs">{p.wooMapping?.syncedAt ? fmtDate(p.wooMapping.syncedAt) : "—"}</td>
                    <td>
                      <button
                        className="btn btn-secondary text-[11px] py-1.5 px-3"
                        onClick={() => syncOne(p.id)}
                        disabled={syncing === p.id}
                        data-testid={`sync-product-${p.sku}`}
                      >
                        <ArrowsClockwise size={12} weight="bold" className={syncing === p.id ? "animate-spin" : ""} />
                        Sync
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
