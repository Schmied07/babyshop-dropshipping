import { NavLink, useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  ChartLineUp, Package, Storefront, ShoppingBag, Percent, ArrowsClockwise,
  BellRinging, SignOut, MagnifyingGlass, PlugsConnected, DownloadSimple, Robot,
} from "@phosphor-icons/react";
import { useAuth } from "../lib/auth";
import api from "../lib/api";
import { cn } from "../lib/format";

const links = [
  { to: "/", label: "Tableau de bord", icon: ChartLineUp, testid: "nav-dashboard" },
  { to: "/commandes", label: "Commandes", icon: ShoppingBag, testid: "nav-orders" },
  { to: "/catalogue", label: "Catalogue", icon: Package, testid: "nav-catalog" },
  { to: "/fournisseurs", label: "Fournisseurs", icon: Storefront, testid: "nav-suppliers" },
  { to: "/import", label: "Import catalogue", icon: DownloadSimple, testid: "nav-import" },
  { to: "/regles-prix", label: "Règles de prix", icon: Percent, testid: "nav-pricing" },
  { to: "/woocommerce", label: "WooCommerce", icon: ArrowsClockwise, testid: "nav-woocommerce" },
  { to: "/automatisations", label: "Automatisations", icon: Robot, testid: "nav-automations" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

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

  return (
    <div className="min-h-screen flex bg-background">
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
          <div className="flex items-center gap-3 text-zinc-400">
            <MagnifyingGlass size={16} weight="bold" />
            <span className="text-[13px] mono">Rechercher · <kbd className="px-1.5 py-0.5 border border-border bg-muted text-[10px] mono">Ctrl+K</kbd></span>
          </div>
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
