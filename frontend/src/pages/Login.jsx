import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../lib/auth";
import { LockKey, EnvelopeSimple, ArrowRight } from "@phosphor-icons/react";

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@marcherbien.fr");
  const [password, setPassword] = useState("Admin1234!");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Connexion réussie");
      nav("/");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Identifiants invalides");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Left: form */}
      <div className="flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md fade-up">
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-9 h-9 bg-primary" />
              <div>
                <div className="font-heading font-black text-lg leading-none tracking-tight">
                  EUROPADROP
                </div>
                <div className="text-[10px] tracking-[0.25em] text-muted-foreground mt-1 uppercase mono">
                  Dropship OS · v1.1
                </div>
              </div>
            </div>
            <h1 className="h1 mb-2">Bienvenue.</h1>
            <p className="text-sm text-muted-foreground">
              Gestion dropshipping fournisseurs européens.
              <br />
              Connectez-vous pour accéder au tableau de bord.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5" data-testid="login-form">
            <div>
              <label className="label">Email professionnel</label>
              <div className="relative">
                <EnvelopeSimple
                  size={16}
                  weight="bold"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="email"
                  className="input pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="login-email"
                />
              </div>
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <LockKey
                  size={16}
                  weight="bold"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="password"
                  className="input pl-9 input-mono"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="login-password"
                />
              </div>
            </div>
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
              data-testid="login-submit"
            >
              {loading ? "Connexion…" : "Se connecter"}
              <ArrowRight size={14} weight="bold" />
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-border text-xs text-muted-foreground mono">
            <div className="uppercase tracking-widest text-[10px] mb-2">Compte de démonstration</div>
            <div>admin@marcherbien.fr</div>
            <div>Admin1234!</div>
          </div>
        </div>
      </div>

      {/* Right: brand panel */}
      <div className="hidden lg:flex bg-sidebar text-white relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-10" />
        <div className="relative z-10 p-16 flex flex-col justify-between w-full">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mono mb-8">
              — European Dropship Command
            </div>
            <h2 className="font-heading font-black text-5xl tracking-tight leading-[1.05] mb-6">
              Fournisseurs<br />européens.<br />
              <span className="text-primary">Marges optimisées.</span>
            </h2>
            <p className="text-zinc-400 text-sm max-w-md leading-relaxed">
              Import catalogue multi-format · Sélection automatique du meilleur fournisseur · Sync
              WooCommerce · Règles de tarification.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-6 pt-8 border-t border-zinc-800">
            <Stat n="4" label="Pays UE" />
            <Stat n="14+" label="Mappings" />
            <Stat n="1-clic" label="Fulfillment" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ n, label }) {
  return (
    <div>
      <div className="font-heading font-black text-3xl tracking-tight">{n}</div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mono mt-1">{label}</div>
    </div>
  );
}
