import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import { PageHeader, Card, Loading, StatusBadge, PaymentBadge } from "../components/Bits";
import { fmtDate, fmtEUR, cn } from "../lib/format";
import { ShoppingBag, Truck, Package, CheckSquare, Square, Lightning, ClockCounterClockwise, ArrowRight, Plus, Trash, X } from "@phosphor-icons/react";

const STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];
const STATUS_LABELS = { pending: "En attente", processing: "En cours", shipped: "Expédiée", delivered: "Livrée", cancelled: "Annulée" };

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
  const [showCreate, setShowCreate] = useState(false);

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

  const changeStatus = async (o, status) => {
    try {
      await api.put(`/orders/${o.id}`, { status });
      toast.success(`Statut → ${STATUS_LABELS[status]}`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };

  const del = async (o) => {
    if (!window.confirm(`Supprimer la commande ${o.orderNumber} ?`)) return;
    try {
      await api.delete(`/orders/${o.id}`);
      toast.success("Commande supprimée");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Supprimer ${selected.size} commande(s) ? Action irréversible.`)) return;
    const res = await Promise.allSettled([...selected].map((id) => api.delete(`/orders/${id}`)));
    const ok = res.filter((r) => r.status === "fulfilled").length;
    const ko = res.length - ok;
    toast[ko ? "warning" : "success"](`${ok} commande(s) supprimée(s)${ko ? ` · ${ko} échec(s)` : ""}`);
    setSelected(new Set());
    load();
  };

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
            <button
              className="btn bg-critical text-white hover:opacity-90"
              onClick={bulkDelete}
              disabled={selected.size === 0}
              data-testid="bulk-delete-orders-btn"
            >
              <Trash size={14} weight="bold" /> Supprimer ({selected.size})
            </button>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)} data-testid="add-order-btn">
              <Plus size={14} weight="bold" /> Nouvelle commande
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
                  <th>Paiement</th>
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
                    <td>
                      <div className="flex flex-col gap-1 items-start">
                        <StatusBadge status={o.status} />
                        <select
                          className="input w-auto text-[10px] py-0.5"
                          value={o.status}
                          onChange={(e) => changeStatus(o, e.target.value)}
                          data-testid={`status-select-${o.orderNumber}`}
                        >
                          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                        </select>
                      </div>
                    </td>
                    <td>
                      <PaymentBadge status={o.paymentStatus || "unpaid"} />
                      {o.paymentMethod && <div className="text-[10px] mono text-muted-foreground mt-0.5">{o.paymentMethod}</div>}
                    </td>
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
                      <div className="flex items-center gap-1">
                        <button
                          className="btn btn-ghost text-[11px] py-1 px-2"
                          onClick={() => setDetailOrder(o)}
                          data-testid={`view-order-${o.orderNumber}`}
                          aria-label="Détails"
                        >
                          <ArrowRight size={14} weight="bold" />
                        </button>
                        <button
                          className="btn btn-ghost text-[11px] py-1 px-2 text-critical"
                          onClick={() => del(o)}
                          data-testid={`delete-order-${o.orderNumber}`}
                          aria-label="Supprimer"
                        >
                          <Trash size={14} weight="bold" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={11} className="text-center py-8 text-muted-foreground">Aucune commande.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {detailOrder && <OrderDetail order={detailOrder} onClose={() => setDetailOrder(null)} onChanged={load} />}
      {showCreate && <OrderCreateModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function OrderCreateModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ customerName: "", customerEmail: "", status: "pending", paymentStatus: "unpaid" });
  const [items, setItems] = useState([{ sku: "", name: "", quantity: 1, price: 0 }]);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm({ ...form, [k]: v });
  const setItem = (i, k, v) => setItems(items.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const total = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0);

  const submit = async () => {
    if (!form.customerName) return toast.error("Nom du client requis");
    setSaving(true);
    try {
      await api.post("/orders", {
        ...form,
        items: items.filter((it) => it.name).map((it) => ({
          productId: "", sku: it.sku, name: it.name,
          quantity: Number(it.quantity) || 1, price: Number(it.price) || 0, supplierCost: 0,
        })),
        total,
      });
      toast.success("Commande créée");
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="order-create-modal">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto border border-border fade-up">
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="h2">Nouvelle commande</div>
          <button className="p-2 hover:bg-muted" onClick={onClose}><X size={18} weight="bold" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nom du client</label>
              <input className="input" value={form.customerName} onChange={(e) => set("customerName", e.target.value)} data-testid="order-customer-name" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" value={form.customerEmail} onChange={(e) => set("customerEmail", e.target.value)} />
            </div>
          </div>
          <div>
            <div className="label mb-2">Articles</div>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 mb-2">
                <input className="input col-span-3 input-mono" placeholder="SKU" value={it.sku} onChange={(e) => setItem(i, "sku", e.target.value)} />
                <input className="input col-span-5" placeholder="Produit" value={it.name} onChange={(e) => setItem(i, "name", e.target.value)} data-testid={`order-item-name-${i}`} />
                <input type="number" className="input col-span-2 input-mono" placeholder="Qté" value={it.quantity} onChange={(e) => setItem(i, "quantity", e.target.value)} />
                <input type="number" step="0.01" className="input col-span-2 input-mono" placeholder="Prix" value={it.price} onChange={(e) => setItem(i, "price", e.target.value)} />
              </div>
            ))}
            <button className="btn btn-ghost text-[11px]" onClick={() => setItems([...items, { sku: "", name: "", quantity: 1, price: 0 }])}>
              <Plus size={12} weight="bold" /> Ajouter une ligne
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Statut</label>
              <select className="input" value={form.status} onChange={(e) => set("status", e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Paiement</label>
              <select className="input" value={form.paymentStatus} onChange={(e) => set("paymentStatus", e.target.value)}>
                <option value="unpaid">En attente</option>
                <option value="paid">Payé</option>
              </select>
            </div>
          </div>
          <div className="text-right mono font-bold">Total : {fmtEUR(total)}</div>
        </div>
        <div className="border-t border-border px-6 py-4 flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving} data-testid="order-create-submit">
            {saving ? "Création…" : "Créer la commande"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderDetail({ order, onClose, onChanged }) {
  const [tracking, setTracking] = useState(order.trackingNumber || "");
  const [carrier, setCarrier] = useState(order.trackingCarrier || "Colissimo");
  const [paymentStatus, setPaymentStatus] = useState(order.paymentStatus || "unpaid");
  const [paymentMethod, setPaymentMethod] = useState(order.paymentMethod || "");
  const [paymentReference, setPaymentReference] = useState(order.paymentReference || "");

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

  const savePayment = async () => {
    try {
      await api.put(`/orders/${order.id}/payment`, {
        paymentStatus, paymentMethod: paymentMethod || null, paymentReference: paymentReference || null,
      });
      toast.success("Paiement mis à jour");
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
          <div className="flex gap-2 items-center">
            <StatusBadge status={order.status} />
            <PaymentBadge status={order.paymentStatus || "unpaid"} />
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

          {/* Payment */}
          <div>
            <div className="label">Paiement</div>
            <div className="grid grid-cols-3 gap-2">
              <select className="input" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} data-testid="payment-status">
                <option value="unpaid">En attente</option>
                <option value="paid">Payé</option>
                <option value="refunded">Remboursé</option>
                <option value="partial_refund">Remboursement partiel</option>
              </select>
              <input
                className="input"
                placeholder="Méthode (CB, PayPal, SEPA…)"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                data-testid="payment-method"
              />
              <input
                className="input input-mono"
                placeholder="Référence transaction"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
            </div>
            <button className="btn btn-secondary mt-2" onClick={savePayment} data-testid="save-payment">
              Enregistrer le paiement
            </button>
          </div>

          {/* Shipping */}
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
