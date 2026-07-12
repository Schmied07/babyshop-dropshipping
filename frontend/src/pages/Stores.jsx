import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import { PageHeader, Card, Loading, StatusBadge } from "../components/Bits";
import { fmtDateTime, cn } from "../lib/format";
import { Storefront, Plus, X, PlugsConnected, Trash, CheckCircle, WarningCircle, Star } from "@phosphor-icons/react";

export default function Stores() {
  const [stores, setStores] = useState([]);
  const [legacy, setLegacy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = () => {
    setLoading(true);
    api.get("/stores").then((r) => {
      setStores(r.data.data || []);
      setLegacy(r.data.legacy_env_configured);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const save = async (form) => {
    try {
      if (editing?.id) {
        await api.put(`/stores/${editing.id}`, form);
        toast.success("Boutique mise à jour");
      } else {
        const r = await api.post("/stores", form);
        if (r.data.warning) toast.warning(r.data.warning);
        else toast.success("Boutique connectée avec succès");
      }
      setShowAdd(false);
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };

  const testStore = async (id) => {
    toast.promise(api.post(`/stores/${id}/test`).then((r) => {
      if (!r.data.reachable) throw new Error(r.data.error || `HTTP ${r.data.status_code}`);
      load();
    }), {
      loading: "Test de connexion…",
      success: "✓ Connexion réussie",
      error: (e) => "Échec : " + (e.message || "erreur"),
    });
  };

  const del = async (id) => {
    if (!window.confirm("Supprimer cette boutique ? Les mappings de produits liés seront aussi supprimés.")) return;
    await api.delete(`/stores/${id}`);
    toast.success("Boutique supprimée");
    load();
  };

  return (
    <div className="p-8 lg:p-12 fade-up">
      <PageHeader
        title="Boutiques WordPress"
        subtitle="Connectez plusieurs boutiques WooCommerce et synchronisez vos produits vers chacune"
        action={
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowAdd(true); }} data-testid="add-store-btn">
            <Plus size={14} weight="bold" /> Nouvelle boutique
          </button>
        }
      />

      {legacy && stores.length === 0 && (
        <Card className="mb-6">
          <div className="p-6 flex items-start gap-4 border-l-4 border-warning">
            <WarningCircle size={22} weight="fill" className="text-warning shrink-0" />
            <div>
              <div className="h3 mb-1">Configuration legacy détectée</div>
              <div className="text-sm text-muted-foreground">
                Vos anciennes clés WP_API_URL/KEY/SECRET dans <span className="mono">.env</span> continuent à fonctionner comme "boutique par défaut". Créez une entrée ici pour migrer vers la gestion multi-boutiques (et pouvoir en ajouter d'autres).
              </div>
            </div>
          </div>
        </Card>
      )}

      {loading ? <Loading /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stores.map((s) => (
            <Card key={s.id}>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-11 h-11 flex items-center justify-center",
                      s.lastTestStatus === "success" ? "bg-success" : s.lastTestStatus === "error" ? "bg-critical" : "bg-muted"
                    )}>
                      <Storefront size={22} weight="fill" color="#fff" />
                    </div>
                    <div>
                      <div className="h3 flex items-center gap-2">
                        {s.name}
                        {s.isDefault && <Star size={14} weight="fill" className="text-warning" />}
                      </div>
                      <div className="mono text-[11px] text-muted-foreground mt-1 truncate max-w-xs">{s.url}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {s.isActive ? <span className="badge badge-success">Active</span> : <span className="badge badge-neutral">Inactive</span>}
                    {s.lastTestStatus && (
                      <span className={cn("badge", s.lastTestStatus === "success" ? "badge-success" : "badge-critical")}>
                        {s.lastTestStatus === "success" ? "Connectée" : "Erreur"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                  <div>
                    <div className="label mb-1">Consumer Key</div>
                    <div className="mono">{s.keyPreview}</div>
                  </div>
                  <div>
                    <div className="label mb-1">Dernier test</div>
                    <div className="mono">{s.lastTestedAt ? fmtDateTime(s.lastTestedAt) : "—"}</div>
                  </div>
                </div>

                {s.lastTestError && (
                  <div className="text-xs text-critical mono mb-3 p-2 bg-red-50 border border-critical">{s.lastTestError}</div>
                )}

                <div className="flex gap-2 pt-3 border-t border-border">
                  <button className="btn btn-secondary text-[11px]" onClick={() => testStore(s.id)} data-testid={`test-store-${s.id}`}>
                    <PlugsConnected size={12} weight="bold" /> Tester
                  </button>
                  <button className="btn btn-secondary text-[11px]" onClick={() => { setEditing(s); setShowAdd(true); }}>
                    Modifier
                  </button>
                  <button className="btn btn-ghost text-[11px] text-critical ml-auto" onClick={() => del(s.id)}>
                    <Trash size={14} weight="bold" />
                  </button>
                </div>
              </div>
            </Card>
          ))}

          {stores.length === 0 && !legacy && (
            <div className="col-span-2 border border-dashed border-border p-12 text-center">
              <Storefront size={48} weight="duotone" className="mx-auto text-muted-foreground mb-3" />
              <div className="h3 mb-2">Aucune boutique connectée</div>
              <div className="text-sm text-muted-foreground mb-4">Ajoutez votre première boutique WordPress pour commencer.</div>
              <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
                <Plus size={14} weight="bold" /> Ajouter une boutique
              </button>
            </div>
          )}
        </div>
      )}

      {showAdd && <StoreModal store={editing} onClose={() => { setShowAdd(false); setEditing(null); }} onSave={save} />}
    </div>
  );
}

function StoreModal({ store, onClose, onSave }) {
  const [form, setForm] = useState({
    name: store?.name || "",
    url: store?.url || "",
    key: "",
    secret: "",
    isDefault: store?.isDefault || false,
    isActive: store?.isActive ?? true,
  });
  const set = (k, v) => setForm({ ...form, [k]: v });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg border border-border fade-up" data-testid="store-modal">
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="h2">{store ? "Modifier boutique" : "Nouvelle boutique WordPress"}</div>
          <button className="p-2 hover:bg-muted" onClick={onClose}><X size={18} weight="bold" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Nom (ex: "Boutique FR", "Shop UK")</label>
            <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} data-testid="store-name" />
          </div>
          <div>
            <label className="label">URL de l'API WooCommerce</label>
            <input className="input input-mono" placeholder="https://votresite.com/wp-json/wc/v3" value={form.url} onChange={(e) => set("url", e.target.value)} data-testid="store-url" />
            <div className="text-[10px] mono text-muted-foreground mt-1">Ex: https://marcherbien.fr/wp-json/wc/v3</div>
          </div>
          <div>
            <label className="label">Consumer Key {store && <span className="text-muted-foreground text-[10px]">(laisser vide pour ne pas changer)</span>}</label>
            <input className="input input-mono" placeholder="ck_..." value={form.key} onChange={(e) => set("key", e.target.value)} data-testid="store-key" />
          </div>
          <div>
            <label className="label">Consumer Secret</label>
            <input type="password" className="input input-mono" placeholder="cs_..." value={form.secret} onChange={(e) => set("secret", e.target.value)} data-testid="store-secret" />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isDefault} onChange={(e) => set("isDefault", e.target.checked)} />
              Boutique par défaut
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} />
              Active
            </label>
          </div>
          <div className="text-[11px] text-muted-foreground bg-muted p-3">
            Créez les clés API dans WordPress : <span className="mono">WooCommerce → Réglages → Avancé → API REST → Ajouter clé</span>.
            Permissions requises : <span className="mono">Lecture/Écriture</span>.
          </div>
        </div>
        <div className="border-t border-border px-6 py-4 flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={() => onSave(form)} data-testid="store-save">
            <CheckCircle size={14} weight="bold" /> {store ? "Enregistrer" : "Connecter"}
          </button>
        </div>
      </div>
    </div>
  );
}
