import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import { PageHeader, Card, Loading, StatusBadge } from "../components/Bits";
import { fmtDate, fmtEUR, cn } from "../lib/format";
import { ShoppingBag, Truck, Package, CheckSquare, Square, Lightning, ClockCounterClockwise, ArrowRight } from "@phosphor-icons/react";

const FILTERS = [
  { key: "all", label: "Toutes" },
  { key: "pending", label: "En attente" },
  { key: "processing", label: "En cours" },
  { key: "shipped", label: "Expédiées" },
];

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(new Set());
  const [strategy, setStrategy] = useState("cheapest");
  const [detailOrder, setDetailOrder] = useState(null);

  const load = () => {
    setLoading(true);
    const params = filter !== "all" ? { status: filter } : {};
    api.get("/orders", { params }).then((r) => {
      setOrders(r.data.data || []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === orders.length) setSelected(new Set());
    else setSelected(new Set(orders.map((o) => o.id)));
  };

  const bulkFulfill = async () => {
    if (selected.size === 0) return toast.error("Sélectionnez au moins une commande");
    try {
      const r = await api.post("/orders/bulk-fulfill", {
        orderIds: [...selected],
        strategy,
      });
      toast.success(`${r.data.results?.length || 0} commandes traitées`);
      setSelected(new Set());
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };

  const stats = useMemo(() => ({
    pending: orders.filter((o) => o.status === "pending").length,
    total: orders.reduce((sum, o) => sum + (o.total || 0), 0),
  }), [orders]);

  return (
    <div className="p-8 lg:p-12 fade-up">
      <PageHeader
        title="Commandes"
        subtitle={`${orders.length} commandes · ${fmtEUR(stats.total)} de CA`}
        action={
          <>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              className="input w-auto text-xs mono uppercase"
              data-testid="fulfill-strategy"
            >
              <option value="cheapest">Moins cher</option>
              <option value="fastest">Plus rapide</option>
              <option value="most_stock">Le plus de stock</option>
              <option value="balanced">Équilibré</option>
            </select>
            <button
              className="btn btn-primary"
              onClick={bulkFulfill}
              disabled={selected.size === 0}
              data-testid="bulk-fulfill-btn"
            >
              <Lightning size={14} weight="bold" /> Traiter en masse ({selected.size})
            </button>
          </>
        }
      />

      <div className="flex items-center gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={cn("btn", filter === f.key ? "btn-primary" : "btn-secondary")}
            onClick={() => { setFilter(f.key); setSelected(new Set()); }}
            data-testid={`filter-${f.key}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? <Loading /> : (
        <Card>
          <div className="table-wrap">
            <table className="data-table" data-testid="orders-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <button onClick={toggleAll} className="text-primary" data-testid="select-all">
                      {selected.size === orders.length && orders.length > 0 ? <CheckSquare size={16} weight="fill" /> : <Square size={16} weight="bold" />}
                    </button>
                  </th>
                  <th>N° commande</th>
                  <th>Client</th>
                  <th className="num">Articles</th>
                  <th className="num">Total</th>
                  <th>Statut</th>
                  <th>Fulfillment</th>
                  <th>Tracking</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <button onClick={() => toggle(o.id)} className="text-primary" data-testid={`select-${o.orderNumber}`}>
                        {selected.has(o.id) ? <CheckSquare size={16} weight="fill" /> : <Square size={16} weight="bold" />}
                      </button>
                    </td>
                    <td className="mono font-bold">{o.orderNumber}</td>
                    <td>
                      <div className="text-[13px] font-semibold">{o.customerName}</div>
                      <div className="text-[11px] text-muted-foreground">{o.customerEmail}</div>
                    </td>
                    <td className="num">{o.items?.length || 0}</td>
                    <td className="num font-bold">{fmtEUR(o.total)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td><StatusBadge status={o.fulfillmentStatus} /></td>
                    <td className="mono text-[11px]">
                      {o.trackingNumber ? (
                        <div>
                          <div>{o.trackingNumber}</div>
                          <div className="text-muted-foreground text-[10px] uppercase">{o.trackingCarrier}</div>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="text-xs">{fmtDate(o.createdAt)}</td>
                    <td>
                      <button
                        className="btn btn-ghost text-[11px] py-1 px-2"
                        onClick={() => setDetailOrder(o)}
                        data-testid={`view-order-${o.orderNumber}`}
                      >
                        <ArrowRight size={14} weight="bold" />
                      </button>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">Aucune commande.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {detailOrder && <OrderDetail order={detailOrder} onClose={() => setDetailOrder(null)} onChanged={load} />}
    </div>
  );
}

function OrderDetail({ order, onClose, onChanged }) {
  const [tracking, setTracking] = useState(order.trackingNumber || "");
  const [carrier, setCarrier] = useState(order.trackingCarrier || "Colissimo");

  const saveTracking = async () => {
    try {
      await api.post(`/orders/${order.id}/tracking`, { trackingNumber: tracking, trackingCarrier: carrier });
      toast.success("Tracking enregistré · commande expédiée");
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white h-full overflow-y-auto border-l border-border fade-up">
        <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="h2 mono">{order.orderNumber}</div>
            <div className="text-xs text-muted-foreground mt-1">{order.customerName} · {order.customerEmail}</div>
          </div>
          <div className="flex gap-2">
            <StatusBadge status={order.status} />
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <div className="label">Articles</div>
            <div className="border border-border">
              {order.items?.map((it, i) => (
                <div key={i} className="p-3 border-b border-border last:border-0 flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold">{it.name}</div>
                    <div className="mono text-[11px] text-muted-foreground">
                      {it.sku} · {it.quantity} × {fmtEUR(it.price)}
                    </div>
                    {it.supplierId && (
                      <div className="text-[10px] mono uppercase tracking-widest text-primary mt-1">
                        Fourni par {it.supplierSku} · Coût {fmtEUR(it.supplierCost)}
                      </div>
                    )}
                  </div>
                  <div className="mono font-bold">{fmtEUR(it.quantity * it.price)}</div>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-3">
              <div className="mono text-lg font-bold">Total : {fmtEUR(order.total)}</div>
            </div>
          </div>

          <div>
            <div className="label">Ajouter / mettre à jour le tracking</div>
            <div className="flex gap-2">
              <input
                className="input input-mono flex-1"
                placeholder="Numéro de suivi"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                data-testid="tracking-input"
              />
              <select className="input w-40" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
                {["Colissimo", "Chronopost", "DPD", "UPS", "DHL", "GLS", "FedEx", "Mondial Relay"].map((c) => <option key={c}>{c}</option>)}
              </select>
              <button className="btn btn-primary" onClick={saveTracking} data-testid="save-tracking">
                <Truck size={14} weight="bold" /> Expédier
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
