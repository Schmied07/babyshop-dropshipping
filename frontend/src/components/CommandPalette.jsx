import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  MagnifyingGlass, ArrowRight, Package, ChartLineUp, ShoppingBag, Storefront,
  DownloadSimple, Percent, ArrowsClockwise, Buildings, Robot, Key, Users as UsersIcon,
  BellRinging, Gear, TrendUp, Lightning, FileCsv, CornersOut,
} from "@phosphor-icons/react";
import api, { downloadCSV } from "../lib/api";

const NAV = [
  { label: "Tableau de bord", to: "/", icon: ChartLineUp, kw: "dashboard accueil kpi" },
  { label: "Commandes", to: "/commandes", icon: ShoppingBag, kw: "orders ventes" },
  { label: "Catalogue", to: "/catalogue", icon: Package, kw: "produits products" },
  { label: "Fournisseurs", to: "/fournisseurs", icon: Storefront, kw: "suppliers" },
  { label: "Import catalogue", to: "/import", icon: DownloadSimple, kw: "csv xlsx" },
  { label: "Règles de prix", to: "/regles-prix", icon: Percent, kw: "pricing marge" },
  { label: "WooCommerce", to: "/woocommerce", icon: ArrowsClockwise, kw: "sync wordpress" },
  { label: "Boutiques WP", to: "/boutiques", icon: Buildings, kw: "stores multi" },
  { label: "Veille prix concurrents", to: "/veille-prix", icon: TrendUp, kw: "competitor concurrent alertes" },
  { label: "Automatisations", to: "/automatisations", icon: Robot, kw: "cron webhooks n8n" },
  { label: "Clés API", to: "/cles-api", icon: Key, kw: "api keys tokens" },
  { label: "Utilisateurs", to: "/utilisateurs", icon: UsersIcon, kw: "users equipe" },
  { label: "Réglages (devise · TVA)", to: "/reglages", icon: Gear, kw: "settings currency vat tva devise" },
  { label: "Notifications", to: "/notifications", icon: BellRinging, kw: "alertes" },
];

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [prodResults, setProdResults] = useState([]);
  const inputRef = useRef(null);

  const go = (to) => { onClose(); navigate(to); };

  const ACTIONS = useMemo(() => [
    { label: "Appliquer les règles de prix", icon: Lightning, kw: "recalcul marge",
      run: () => { toast.promise(api.post("/pricing-rules/apply-all"), { loading: "Application…", success: "Prix recalculés", error: "Erreur" }); onClose(); } },
    { label: "Exporter les produits (CSV)", icon: FileCsv, kw: "export download",
      run: () => { downloadCSV("/export/products.csv", "produits.csv"); toast.success("Export produits lancé"); onClose(); } },
    { label: "Exporter les commandes (CSV)", icon: FileCsv, kw: "export download",
      run: () => { downloadCSV("/export/orders.csv", "commandes.csv"); toast.success("Export commandes lancé"); onClose(); } },
  ], [onClose]);

  useEffect(() => {
    if (open) { setQ(""); setActive(0); setProdResults([]); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  useEffect(() => {
    if (!open || q.trim().length < 2) { setProdResults([]); return; }
    const t = setTimeout(() => {
      api.get("/products", { params: { q: q.trim(), limit: 5 } })
        .then((r) => setProdResults(r.data.data || []))
        .catch(() => setProdResults([]));
    }, 220);
    return () => clearTimeout(t);
  }, [q, open]);

  const filterKw = (items) => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) => (i.label + " " + (i.kw || "")).toLowerCase().includes(s));
  };

  const navItems = filterKw(NAV);
  const actionItems = filterKw(ACTIONS);
  const productItems = prodResults.map((p) => ({
    label: p.name, sub: p.sku, icon: Package, isProduct: true,
    run: () => go("/catalogue"),
  }));

  const flat = [
    ...navItems.map((i) => ({ ...i, section: "Navigation", run: () => go(i.to) })),
    ...actionItems.map((i) => ({ ...i, section: "Actions" })),
    ...productItems.map((i) => ({ ...i, section: "Produits" })),
  ];

  useEffect(() => { setActive(0); }, [q, prodResults.length]);

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); flat[active]?.run?.(); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  if (!open) return null;

  let rendered = -1;
  let lastSection = null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4" data-testid="command-palette">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white border border-border shadow-2xl fade-up" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-3 px-4 h-14 border-b border-border">
          <MagnifyingGlass size={18} weight="bold" className="text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher une page, une action, un produit…"
            className="flex-1 bg-transparent outline-none text-sm"
            data-testid="command-palette-input"
          />
          <kbd className="px-1.5 py-0.5 border border-border bg-muted text-[10px] mono">ESC</kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto py-2">
          {flat.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Aucun résultat.</div>
          )}
          {flat.map((item, i) => {
            rendered = i;
            const showHeader = item.section !== lastSection;
            lastSection = item.section;
            const Icon = item.icon || ArrowRight;
            const isActive = i === active;
            return (
              <div key={i}>
                {showHeader && (
                  <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">
                    {item.section}
                  </div>
                )}
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => item.run?.()}
                  data-testid={`cmd-item-${i}`}
                  className={"w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors " + (isActive ? "bg-primary text-white" : "hover:bg-muted")}
                >
                  <Icon size={16} weight="duotone" className={isActive ? "text-white" : "text-muted-foreground"} />
                  <span className="flex-1 min-w-0">
                    <span className="text-[13px] font-semibold block truncate">{item.label}</span>
                    {item.sub && <span className={"mono text-[11px] block " + (isActive ? "text-white/70" : "text-muted-foreground")}>{item.sub}</span>}
                  </span>
                  {isActive && <CornersOut size={14} weight="bold" className="opacity-60" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
