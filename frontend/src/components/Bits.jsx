import { cn } from "../lib/format";

export function StatusBadge({ status }) {
  const map = {
    pending: { label: "En attente", cls: "badge-warning" },
    processing: { label: "En cours", cls: "badge-info" },
    shipped: { label: "Expédiée", cls: "badge-success" },
    delivered: { label: "Livrée", cls: "badge-success" },
    cancelled: { label: "Annulée", cls: "badge-neutral" },
    unfulfilled: { label: "Non traité", cls: "badge-warning" },
    in_progress: { label: "En traitement", cls: "badge-info" },
    fulfilled: { label: "Traité", cls: "badge-success" },
    active: { label: "Actif", cls: "badge-success" },
    inactive: { label: "Inactif", cls: "badge-neutral" },
    success: { label: "Succès", cls: "badge-success" },
    error: { label: "Erreur", cls: "badge-critical" },
    mocked: { label: "Simulé", cls: "badge-info" },
  };
  const it = map[status] || { label: status || "—", cls: "badge-neutral" };
  return <span className={cn("badge", it.cls)}>{it.label}</span>;
}

export function StockBadge({ stock }) {
  if (stock === undefined || stock === null) return <span className="badge badge-neutral">—</span>;
  if (stock <= 0) return <span className="badge badge-critical">Rupture</span>;
  if (stock < 10) return <span className="badge badge-warning">{stock} · Bas</span>;
  if (stock < 50) return <span className="badge badge-info">{stock}</span>;
  return <span className="badge badge-success">{stock}</span>;
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="border border-dashed border-border bg-white p-12 text-center">
      <div className="font-heading text-lg mb-2">{title}</div>
      {hint && <div className="text-sm text-muted-foreground mb-4">{hint}</div>}
      {action}
    </div>
  );
}

export function Card({ children, className, title, action }) {
  return (
    <div className={cn("card", className)}>
      {(title || action) && (
        <div className="card-header flex items-center justify-between">
          <div className="h3">{title}</div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-8 fade-up">
      <div>
        <h1 className="h1">{title}</h1>
        {subtitle && <div className="text-sm text-muted-foreground mt-2">{subtitle}</div>}
      </div>
      {action && <div className="flex gap-2">{action}</div>}
    </div>
  );
}

export function Loading({ text = "Chargement…" }) {
  return (
    <div className="p-12 text-center text-sm text-muted-foreground mono uppercase tracking-widest">
      {text}
    </div>
  );
}
