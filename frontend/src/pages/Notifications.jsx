import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import { PageHeader, Card, Loading } from "../components/Bits";
import { fmtDateTime, cn } from "../lib/format";
import { BellRinging, Warning, ShoppingBag, ArrowsClockwise, Check, CheckCircle } from "@phosphor-icons/react";
import { Link } from "react-router-dom";

const ICON = {
  low_stock: Warning,
  order_new: ShoppingBag,
  sync_error: ArrowsClockwise,
  price_change: BellRinging,
};

const SEVERITY = {
  critical: "border-critical bg-red-50",
  warning: "border-warning bg-amber-50",
  info: "border-primary bg-blue-50",
};

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/notifications").then((r) => {
      setItems(r.data.data || []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const markAll = async () => {
    await api.post("/notifications/mark-all-read");
    toast.success("Toutes marquées comme lues");
    load();
  };

  const markRead = async (id) => {
    await api.put(`/notifications/${id}/read`);
    load();
  };

  return (
    <div className="p-8 lg:p-12 fade-up">
      <PageHeader
        title="Notifications"
        subtitle={`${items.filter((n) => !n.read).length} non lues`}
        action={
          <button className="btn btn-secondary" onClick={markAll} data-testid="mark-all-read">
            <CheckCircle size={14} weight="bold" /> Tout marquer comme lu
          </button>
        }
      />

      {loading ? <Loading /> : (
        <div className="space-y-2">
          {items.map((n) => {
            const Ic = ICON[n.type] || BellRinging;
            return (
              <div
                key={n.id}
                className={cn(
                  "border-l-4 border border-border bg-white p-4 flex items-start gap-4",
                  SEVERITY[n.severity] || "",
                  n.read && "opacity-60"
                )}
                data-testid={`notif-${n.id}`}
              >
                <Ic size={22} weight="duotone" className={cn(
                  "shrink-0 mt-0.5",
                  n.severity === "critical" && "text-critical",
                  n.severity === "warning" && "text-warning",
                  n.severity === "info" && "text-primary",
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-heading font-bold text-[15px]">{n.title}</div>
                    {!n.read && <span className="w-1.5 h-1.5 bg-accent" />}
                  </div>
                  <div className="text-sm text-muted-foreground">{n.message}</div>
                  <div className="text-[10px] mono uppercase tracking-widest text-muted-foreground mt-2">{fmtDateTime(n.createdAt)}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {n.link && <Link to={n.link} className="btn btn-ghost text-[11px] py-1 px-2">Voir</Link>}
                  {!n.read && <button className="btn btn-ghost text-[11px] py-1 px-2" onClick={() => markRead(n.id)}><Check size={14} weight="bold" /></button>}
                </div>
              </div>
            );
          })}
          {items.length === 0 && (
            <div className="border border-dashed border-border p-12 text-center text-muted-foreground">
              <BellRinging size={40} weight="duotone" className="mx-auto mb-3 text-muted-foreground" />
              Aucune notification pour l'instant.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
