import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import { PageHeader, Card, Loading } from "../components/Bits";
import { fmtDateTime, cn } from "../lib/format";
import { Key, Plus, X, Copy, Trash, Warning, ShieldCheck, Robot } from "@phosphor-icons/react";

export default function ApiKeys() {
  const [keys, setKeys] = useState([]);
  const [scopes, setScopes] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState(null);

  const load = () => {
    setLoading(true);
    api.get("/api-keys").then((r) => {
      setKeys(r.data.data || []);
      setScopes(r.data.available_scopes || {});
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const revoke = async (id) => {
    if (!window.confirm("Révoquer cette clé ? Toute intégration l'utilisant cessera de fonctionner immédiatement.")) return;
    await api.post(`/api-keys/${id}/revoke`);
    toast.success("Clé révoquée");
    load();
  };

  const del = async (id) => {
    if (!window.confirm("Supprimer définitivement cette clé ?")) return;
    await api.delete(`/api-keys/${id}`);
    toast.success("Clé supprimée");
    load();
  };

  const create = async (form) => {
    try {
      const r = await api.post("/api-keys", form);
      setNewKeyResult(r.data);
      setShowCreate(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };

  return (
    <div className="p-8 lg:p-12 fade-up">
      <PageHeader
        title="Clés API"
        subtitle="Donnez à Claude, n8n ou tout agent externe un accès scopé à votre EuropaDrop"
        action={
          <button className="btn btn-primary" onClick={() => setShowCreate(true)} data-testid="new-api-key-btn">
            <Plus size={14} weight="bold" /> Nouvelle clé
          </button>
        }
      />

      {/* Explanation card */}
      <Card className="mb-6">
        <div className="p-6 flex items-start gap-4">
          <div className="w-11 h-11 bg-primary flex items-center justify-center shrink-0">
            <ShieldCheck size={22} weight="fill" color="#fff" />
          </div>
          <div>
            <div className="h3 mb-1">Contrôle granulaire par scope</div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              Chaque clé API a ses propres permissions (scopes). Utilisez le scope <span className="mono">*</span> pour un accès total (Claude en mode plein contrôle), ou combinez des scopes spécifiques pour limiter l'agent à des actions précises.
              Auth header : <span className="mono">Authorization: Bearer ed_...</span>
            </div>
          </div>
        </div>
      </Card>

      {loading ? <Loading /> : (
        <Card title={`Clés actives (${keys.filter(k => !k.revoked).length})`}>
          <div className="table-wrap">
            <table className="data-table" data-testid="api-keys-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Préfixe</th>
                  <th>Scopes</th>
                  <th>Créée le</th>
                  <th>Dernière utilisation</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td>
                      <div className="font-semibold text-[13px]">{k.name}</div>
                      {k.description && <div className="text-[11px] text-muted-foreground">{k.description}</div>}
                    </td>
                    <td className="mono text-[11px]">{k.keyPrefix}</td>
                    <td>
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {k.scopes.slice(0, 4).map(s => (
                          <span key={s} className={cn("badge mono text-[10px]", s === "*" ? "badge-primary" : "badge-neutral")}>{s}</span>
                        ))}
                        {k.scopes.length > 4 && <span className="badge badge-neutral mono text-[10px]">+{k.scopes.length - 4}</span>}
                      </div>
                    </td>
                    <td className="text-xs">{fmtDateTime(k.createdAt)}</td>
                    <td className="text-xs">{k.lastUsedAt ? fmtDateTime(k.lastUsedAt) : <span className="text-muted-foreground">Jamais</span>}</td>
                    <td>{k.revoked ? <span className="badge badge-critical">Révoquée</span> : <span className="badge badge-success">Active</span>}</td>
                    <td>
                      <div className="flex gap-1">
                        {!k.revoked && (
                          <button className="btn btn-ghost text-[11px] py-1 px-2" onClick={() => revoke(k.id)} data-testid={`revoke-${k.id}`}>Révoquer</button>
                        )}
                        <button className="btn btn-ghost text-[11px] py-1 px-2 text-critical" onClick={() => del(k.id)}>
                          <Trash size={14} weight="bold" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {keys.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Aucune clé API. Créez-en une pour permettre à un agent externe (Claude, n8n) d'accéder à votre EuropaDrop.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showCreate && <CreateKeyModal scopes={scopes} onClose={() => setShowCreate(false)} onSave={create} />}
      {newKeyResult && <NewKeyDisplay result={newKeyResult} onClose={() => setNewKeyResult(null)} />}
    </div>
  );
}

const SCOPE_PRESETS = {
  "Full control (Claude)": ["*"],
  "Read only": ["products.read", "suppliers.read", "orders.read", "notifications.read", "dashboard.read"],
  "Order automation (n8n)": ["orders.read", "orders.write", "orders.tracking", "orders.payment", "notifications.read"],
  "Product sync (n8n)": ["products.read", "products.write", "supplier_products.read", "sync.run", "sync.status"],
  "AI assistant only": ["ai.translate", "ai.seo", "ai.mapping", "products.read", "products.write"],
};

function CreateKeyModal({ scopes, onClose, onSave }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState(new Set());

  const toggle = (s) => {
    const next = new Set(selected);
    next.has(s) ? next.delete(s) : next.add(s);
    setSelected(next);
  };

  const applyPreset = (preset) => {
    setSelected(new Set(SCOPE_PRESETS[preset]));
  };

  const submit = () => {
    if (!name.trim()) return toast.error("Nom obligatoire");
    if (selected.size === 0) return toast.error("Au moins un scope requis");
    onSave({ name, description, scopes: [...selected] });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-border fade-up" data-testid="create-key-modal">
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="h2 flex items-center gap-2"><Key size={18} weight="duotone" /> Nouvelle clé API</div>
          <button className="p-2 hover:bg-muted" onClick={onClose}><X size={18} weight="bold" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nom (ex: "Claude", "n8n Prod")</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} data-testid="key-name" />
            </div>
            <div>
              <label className="label">Description (optionnel)</label>
              <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Préconfigurations rapides</label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(SCOPE_PRESETS).map(p => (
                <button
                  key={p}
                  className="text-[11px] mono uppercase tracking-widest px-3 py-1.5 border border-border hover:bg-muted"
                  onClick={() => applyPreset(p)}
                  data-testid={`preset-${p}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Scopes personnalisés ({selected.size} sélectionnés)</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1 border border-border p-3 max-h-80 overflow-y-auto">
              {Object.entries(scopes).map(([k, desc]) => (
                <label key={k} className={cn(
                  "flex items-start gap-3 p-2 hover:bg-muted cursor-pointer",
                  selected.has(k) && "bg-blue-50"
                )}>
                  <input
                    type="checkbox"
                    checked={selected.has(k)}
                    onChange={() => toggle(k)}
                    className="mt-1"
                    data-testid={`scope-${k}`}
                  />
                  <div className="min-w-0">
                    <div className={cn("mono text-[11px] font-bold", k === "*" && "text-primary")}>{k}</div>
                    <div className="text-[11px] text-muted-foreground">{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-border px-6 py-4 flex gap-2 justify-end">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={submit} data-testid="create-key-submit">
            <Key size={14} weight="bold" /> Générer la clé
          </button>
        </div>
      </div>
    </div>
  );
}

function NewKeyDisplay({ result, onClose }) {
  const copy = () => {
    navigator.clipboard.writeText(result.key);
    toast.success("Clé copiée");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-white w-full max-w-xl border-2 border-primary fade-up">
        <div className="border-b border-border px-6 py-4 bg-primary text-white flex items-center gap-2">
          <Warning size={20} weight="fill" />
          <div className="font-heading font-bold text-lg">Copiez cette clé immédiatement</div>
        </div>
        <div className="p-6 space-y-4">
          <div className="text-sm text-muted-foreground">
            <strong>Cette clé ne sera plus jamais affichée.</strong> Copiez-la maintenant dans un gestionnaire de secrets (1Password, Bitwarden, Vault) ou dans votre configuration n8n/Claude.
          </div>
          <div>
            <label className="label">Clé API</label>
            <div className="flex gap-2">
              <input className="input input-mono flex-1 text-[13px]" readOnly value={result.key} data-testid="new-key-value" />
              <button className="btn btn-primary" onClick={copy} data-testid="copy-new-key">
                <Copy size={14} weight="bold" /> Copier
              </button>
            </div>
          </div>
          <div>
            <label className="label">Scopes accordés</label>
            <div className="flex flex-wrap gap-1">
              {result.scopes.map(s => (
                <span key={s} className={cn("badge mono", s === "*" ? "badge-primary" : "badge-neutral")}>{s}</span>
              ))}
            </div>
          </div>
          <div className="border border-border p-3 bg-muted text-[11px] mono">
            <div className="uppercase tracking-widest text-muted-foreground mb-2">Test curl</div>
            <div>curl -H "Authorization: Bearer {result.key.slice(0, 20)}..." \</div>
            <div>&nbsp;&nbsp;{window.location.origin}/api/products</div>
          </div>
        </div>
        <div className="border-t border-border px-6 py-4 flex justify-end">
          <button className="btn btn-primary" onClick={onClose} data-testid="key-displayed-close">
            J'ai copié la clé
          </button>
        </div>
      </div>
    </div>
  );
}
