import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid,
} from "recharts";
import { TrendUp, Package, Warning, ShoppingBag, CurrencyEur, Truck, Buildings, FileCsv } from "@phosphor-icons/react";
import api, { downloadCSV } from "../lib/api";
import { fmtEUR, fmtNumber, fmtDate } from "../lib/format";
import { PageHeader, Card, Loading, StockBadge } from "../components/Bits";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [perf, setPerf] = useState([]);
  const [stores, setStores] = useState([]);

  useEffect(() => {
    api.get("/dashboard/overview").then((r) => setData(r.data));
    api.get("/dashboard/supplier-performance").then((r) => setPerf(r.data.data || []));
    api.get("/dashboard/store-analytics").then((r) => setStores(r.data.data || []));
  }, []);

  if (!data) return <div className="p-12"><Loading /></div>;
  const m = data.metrics;

  const exportCSV = (kind) => {
    downloadCSV(`/export/${kind}.csv`, `${kind === "products" ? "produits" : "commandes"}.csv`);
    toast.success(`Export ${kind === "products" ? "produits" : "commandes"} lancé`);
  };

  return (
    <div className="p-8 lg:p-12 fade-up">
      <PageHeader
        title="Tableau de bord"
        subtitle={`Mise à jour : ${new Date().toLocaleString("fr-FR")}`}
        action={
          <>
            <button className="btn btn-secondary" data-testid="export-products-btn" onClick={() => exportCSV("products")}>
              <FileCsv size={14} weight="bold" /> Produits CSV
            </button>
            <button className="btn btn-secondary" data-testid="export-orders-btn" onClick={() => exportCSV("orders")}>
              <FileCsv size={14} weight="bold" /> Commandes CSV
            </button>
          </>
        }
      />

      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" data-testid="metrics-grid">
        <Metric icon={CurrencyEur} label="Chiffre d'affaires" value={fmtEUR(m.revenue)} hint={`Marge · ${fmtEUR(m.margin)} (${m.marginPercent}%)`} />
        <Metric icon={ShoppingBag} label="Commandes en attente" value={fmtNumber(m.pendingOrders)} hint={`sur ${m.totalOrders} au total`} />
        <Metric icon={Warning} label="Alertes de stock" value={fmtNumber(m.lowStockCount)} hint={`${m.unreadNotifications} notifs non lues`} accent={m.lowStockCount > 0} />
        <Metric icon={Package} label="Catalogue" value={fmtNumber(m.totalProducts)} hint={`${m.totalSuppliers} fournisseurs actifs`} />
      </div>

      {/* Per-store analytics */}
      {stores.length > 0 && (
        <Card
          title="Analytics par boutique"
          className="mb-8"
          action={<Link to="/boutiques" className="btn btn-ghost text-[11px]">Gérer les boutiques →</Link>}
        >
          <div className="table-wrap">
            <table className="data-table" data-testid="store-analytics-table">
              <thead>
                <tr>
                  <th>Boutique</th>
                  <th className="num">Produits publiés</th>
                  <th className="num">Valeur catalogue</th>
                  <th className="num">Marge catalogue</th>
                  <th className="num">Commandes</th>
                  <th className="num">CA</th>
                  <th className="num">Marge (CA)</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((s, i) => (
                  <tr key={s.storeId || `un-${i}`} data-testid={`store-analytics-row-${i}`}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Buildings size={16} weight="duotone" className="text-primary" />
                        <div>
                          <div className="font-semibold text-[13px]">{s.storeName}</div>
                          {s.url && <div className="mono text-[10px] text-muted-foreground truncate max-w-[220px]">{s.url}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="num">{fmtNumber(s.publishedCount)}</td>
                    <td className="num">{fmtEUR(s.catalogValue)}</td>
                    <td className="num text-success">{fmtEUR(s.catalogMargin)}</td>
                    <td className="num">{fmtNumber(s.orderCount)}</td>
                    <td className="num font-bold">{fmtEUR(s.revenue)}</td>
                    <td className="num text-success">
                      {fmtEUR(s.margin)} <span className="text-muted-foreground">({s.marginPercent}%)</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <Card title="Revenus sur 14 jours" className="lg:col-span-2">
          <div className="p-4 h-64">
            {data.revenueSeries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Aucune vente enregistrée
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.revenueSeries}>
                  <CartesianGrid strokeDasharray="0" stroke="#F4F4F5" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} stroke="#71717A" />
                  <YAxis tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} stroke="#71717A" />
                  <Tooltip
                    contentStyle={{ background: "#09090B", border: "none", borderRadius: 2, color: "#fff", fontSize: 12 }}
                    formatter={(v) => fmtEUR(v)}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#002FA7" strokeWidth={2} dot={{ r: 3, fill: "#002FA7" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card title="Top produits">
          <div className="p-2">
            {data.topProducts.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Aucune vente.</div>
            ) : (
              data.topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 border-b border-border last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-6 h-6 flex items-center justify-center bg-black text-white text-[11px] mono font-bold">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold truncate">{p.name}</div>
                      <div className="text-[11px] mono text-muted-foreground">{p.sku}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="mono text-[13px] font-bold">{fmtEUR(p.revenue)}</div>
                    <div className="text-[10px] mono text-muted-foreground uppercase">{p.qty}u</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Supplier performance + low stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Performance fournisseurs" action={<Link to="/fournisseurs" className="btn btn-ghost text-[11px]">Voir tous →</Link>}>
          <div className="p-4 h-64">
            {perf.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Aucun fournisseur</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perf}>
                  <CartesianGrid strokeDasharray="0" stroke="#F4F4F5" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontFamily: "IBM Plex Mono" }} stroke="#71717A" />
                  <YAxis tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} stroke="#71717A" />
                  <Tooltip contentStyle={{ background: "#09090B", border: "none", color: "#fff", fontSize: 12 }} />
                  <Bar dataKey="products" fill="#002FA7" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card
          title="Alertes de stock"
          action={<Link to="/catalogue" className="btn btn-ghost text-[11px]">Voir catalogue →</Link>}
        >
          <div>
            {data.lowStockItems.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">Aucune alerte. Tous les stocks sont bons.</div>
            ) : (
              data.lowStockItems.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-4 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold truncate">{p.name}</div>
                    <div className="text-[11px] mono text-muted-foreground">{p.sku}</div>
                  </div>
                  <StockBadge stock={p.stock} />
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, hint, accent }) {
  return (
    <div className="metric relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="metric-label">{label}</div>
        <Icon size={18} weight="duotone" className={accent ? "text-accent" : "text-muted-foreground"} />
      </div>
      <div className={"metric-value mt-2 " + (accent ? "text-accent" : "")}>{value}</div>
      {hint && <div className="metric-hint">{hint}</div>}
    </div>
  );
}
