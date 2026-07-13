import { NavLink, useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  ChartLineUp, Package, Storefront, ShoppingBag, Percent, ArrowsClockwise,
  BellRinging, SignOut, MagnifyingGlass, PlugsConnected, DownloadSimple, Robot, Key,
  Users as UsersIcon, Buildings, Gear, TrendUp, LockSimple, LockSimpleOpen,
} from "@phosphor-icons/react";
import { useAuth } from "../lib/auth";
import api from "../lib/api";
import { cn } from "../lib/format";
import CommandPalette from "./CommandPalette";
import { toast } from "sonner";

const links = [
  { to: "/", label: "Tableau de bord", icon: ChartLineUp, testid: "nav-dashboard" },
  { to: "/commandes", label: "Commandes", icon: ShoppingBag, testid: "nav-orders" },
  { to: "/catalogue", label: "Catalogue", icon: Package, testid: "nav-catalog" },
  { to: "/fournisseurs", label: "Fournisseurs", icon: Storefront, testid: "nav-suppliers" },
  { to: "/import", label: "Import catalogue", icon: DownloadSimple, testid: "nav-import" },
  { to: "/regles-prix", label: "Règles de prix", icon: Percent, testid: "nav-pricing" },
  { to: "/woocommerce", label: "WooCommerce", icon: ArrowsClockwise, testid: "nav-woocommerce" },
  { to: "/boutiques", label: "Boutiques WP", icon: Buildings, testid: "nav-stores" },
  { to: "/veille-prix", label: "Veille prix", icon: TrendUp, testid: "nav-price-watch" },
  { to: "/automatisations", label: "Automatisations", icon: Robot, testid: "nav-automations" },
  { to: "/cles-api", label: "Clés API", icon: Key, testid: "nav-api-keys" },
  { to: "/utilisateurs", label: "Utilisateurs", icon: UsersIcon, testid: "nav-users" },
  { to: "/reglages", label: "Réglages", icon: Gear, testid: "nav-settings" },
];

export default function Layout({ children }) {
  const { user, logout, setToken } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [isolationMode, setIsolationMode] = useState(false);
  const [isolationLoading, setIsolationLoading] = useState(false);

  // Load isolation status
  useEffect(() => {
    if (user?.role === "admin") {
      api.get("/auth/isolation-status").then((r) => {
        if (r.data.available) {
          setIsolationMode(r.data.isolationMode || false);
        }
      }).catch(() => {});
    }
  }, [user]);

  const toggleIsolation = async () => {
    setIsolationLoading(true);
    try {
      const r = await api.post("/auth/toggle-isolation");
      setIsolationMode(r.data.isolationMode);
      setToken(r.data.token); // Update token with new isolation mode
      toast.success(r.data.message);
      // Refresh page to apply new scope
      window.location.reload();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    } finally {
      setIsolationLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = () =>
      api
        .get("/notifications", { params: { unread_only: true } })
        .then((r) => mounted && setUnread(r.data.unread || 0))
        .catch(() => {});
    load();
    const id = setInterval(load, 30000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen flex bg-background">
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-sidebar text-white flex flex-col sticky top-0 h-screen">
        <div className="px-6 pt-8 pb-6 border-b border-zinc-800">
          <Link to="/" className="flex items-center gap-3 group" data-testid="sidebar-logo">
            <div className="w-8 h-8 bg-primary flex items-center justify-center">
              <PlugsConnected size={18} weight="bold" color="#fff" />
            </div>
            <div>
              <div className="font-heading font-black text-[15px] leading-none tracking-tight">
                EUROPADROP
              </div>
              <div className="text-[10px] tracking-[0.2em] text-zinc-400 mt-1 uppercase">
                Dropship OS · UE
              </div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-0.5 overflow-y-auto">
          <div className="px-3 mb-3 text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold">
            Opérations
          </div>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              data-testid={l.testid}
              className={({ isActive }) => cn("sidebar-link", isActive && "active")}
            >
              <l.icon size={18} weight="duotone" />
              <span>{l.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Isolation Mode Toggle (Admin only) */}
        {user?.role === "admin" && (
          <div className="px-4 py-3 border-t border-zinc-800">
            <button
              onClick={toggleIsolation}
              disabled={isolationLoading}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium transition-all",
                isolationMode
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20"
                  : "bg-zinc-800/50 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-800"
              )}
              data-testid="isolation-toggle-btn"
            >
              {isolationMode ? (
                <LockSimple size={16} weight="bold" />
              ) : (
                <LockSimpleOpen size={16} weight="bold" />
              )}
              <div className="flex-1 text-left">
                <div className="font-semibold leading-none mb-0.5">
                  {isolationMode ? "Mode Isolation" : "Mode Supervision"}
                </div>
                <div className="text-[10px] leading-tight opacity-80">
                  {isolationMode ? "Vos données uniquement" : "Toutes les données"}
                </div>
              </div>
            </button>
          </div>
        )}

        <div className="px-4 py-4 border-t border-zinc-800 text-xs">
          <div className="text-zinc-400 mb-2 mono uppercase tracking-widest text-[10px]">
            Utilisateur
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-semibold text-sm">{user?.name}</div>
              <div className="text-zinc-500 text-[11px] mono">{user?.email}</div>
            </div>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              data-testid="logout-btn"
              aria-label="Déconnexion"
            >
              <SignOut size={16} weight="bold" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-border h-16 px-8 flex items-center justify-between">
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-3 text-zinc-400 hover:text-foreground transition-colors"
            data-testid="open-command-palette"
          >
            <MagnifyingGlass size={16} weight="bold" />
            <span className="text-[13px] mono">Rechercher · <kbd className="px-1.5 py-0.5 border border-border bg-muted text-[10px] mono">Ctrl+K</kbd></span>
          </button>
          <div className="flex items-center gap-2">
            <Link
              to="/notifications"
              className="relative p-2 hover:bg-muted transition-colors"
              data-testid="notif-btn"
              aria-label="Notifications"
            >
              <BellRinging size={18} weight="duotone" />
              {unread > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-accent text-white text-[9px] font-bold mono flex items-center justify-center px-1">
                  {unread}
                </span>
              )}
            </Link>
          </div>
        </header>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
