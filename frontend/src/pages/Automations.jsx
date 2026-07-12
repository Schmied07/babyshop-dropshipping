import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import { PageHeader, Card, Loading } from "../components/Bits";
import { fmtDateTime, cn } from "../lib/format";
import {
  Broadcast, Clock, Copy, Play, ArrowsClockwise, CheckCircle,
  ArrowSquareOut, ShuffleAngular, Plus, X, Trash, PaperPlaneTilt, Robot, Book,
} from "@phosphor-icons/react";

export default function Automations() {
  const [webhookInfo, setWebhookInfo] = useState(null);
  const [scheduler, setScheduler] = useState(null);
  const [history, setHistory] = useState([]);
  const [outbound, setOutbound] = useState([]);
  const [events, setEvents] = useState({});
  const [n8n, setN8n] = useState(null);
  const [loading, setLoading] = useState(true);
  const [runningJob, setRunningJob] = useState(null);
  const [showAddOutbound, setShowAddOutbound] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/webhooks/woocommerce/info"),
      api.get("/scheduler/status"),
      api.get("/scheduler/history"),
      api.get("/outbound-webhooks"),
      api.get("/integrations/n8n/info"),
    ]).then(([w, s, h, o, n]) => {
      setWebhookInfo(w.data);
      setScheduler(s.data);
      setHistory(h.data.data || []);
      setOutbound(o.data.data || []);
      setEvents(o.data.available_events || {});
      setN8n(n.data);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const copy = (t) => { navigator.clipboard.writeText(t); toast.success("Copié"); };

  const runNow = async (jobId) => {
    setRunningJob(jobId);
    try {
      await api.post(`/scheduler/run-now/${jobId}`);
      toast.success("Job lancé");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    } finally { setRunningJob(null); }
  };

  const regenerate = async () => {
    if (!window.confirm("Régénérer le secret ? L'ancien cesse de fonctionner immédiatement. Vous devrez mettre à jour vos webhooks WooCommerce.")) return;
    try {
      const r = await api.post("/webhooks/woocommerce/regenerate-secret");
      toast.success("Nouveau secret généré");
      setWebhookInfo({ ...webhookInfo, secret: r.data.secret });
    } catch (e) { toast.error("Erreur"); }
  };

  const addOutbound = async (form) => {
    try {
      await api.post("/outbound-webhooks", form);
      toast.success("Webhook sortant créé");
      setShowAddOutbound(false);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };

  const testOutbound = async (id) => {
    toast.promise(api.post(`/outbound-webhooks/${id}/test`).then((r) => {
      if (!r.data.success) throw new Error(r.data.error || `HTTP ${r.data.status_code}`);
    }).finally(load), {
      loading: "Envoi ping…",
      success: "Ping envoyé avec succès",
      error: (e) => "Échec : " + (e.message || "erreur"),
    });
  };

  const toggleOutbound = async (w) => {
    await api.put(`/outbound-webhooks/${w.id}`, { active: !w.active });
    load();
  };

  const delOutbound = async (id) => {
    if (!window.confirm("Supprimer ce webhook sortant ?")) return;
    await api.delete(`/outbound-webhooks/${id}`);
    toast.success("Supprimé");
    load();
  };

  if (loading) return <div className="p-12"><Loading /></div>;

  return (
    <div className="p-8 lg:p-12 fade-up">
      <PageHeader
        title="Automatisations"
        subtitle="CRON · Webhooks entrants WooCommerce · Webhooks sortants n8n"
      />

      {/* CRON */}
      <Card
        title={<div className="flex items-center gap-2"><Clock size={18} weight="duotone" /> Synchronisation programmée</div>}
        className="mb-6"
      >
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-success flex items-center justify-center">
              <CheckCircle size={22} weight="fill" color="#fff" />
            </div>
            <div>
              <div className="h3">Scheduler actif</div>
              <div className="text-sm text-muted-foreground mt-1 mono">
                Sync stock + prix toutes les {scheduler?.cron_hours}h · Import commandes WC toutes les 30 min
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scheduler?.jobs?.map((job) => (
              <div key={job.id} className="border border-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="h3">{job.id === "stocks_prices_sync" ? "Sync prix + stocks" : "Import commandes WC"}</div>
                    <div className="mono text-[11px] text-muted-foreground mt-1">{job.trigger}</div>
                  </div>
                  <button className="btn btn-secondary text-[11px]" onClick={() => runNow(job.id)} disabled={runningJob === job.id} data-testid={`run-${job.id}`}>
                    <Play size={12} weight="fill" />
                    {runningJob === job.id ? "En cours…" : "Lancer"}
                  </button>
                </div>
                <div className="text-xs text-muted-foreground">
                  Prochaine exécution : <span className="mono">{fmtDateTime(job.next_run)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Webhook WooCommerce entrant */}
      <Card title={<div className="flex items-center gap-2"><Broadcast size={18} weight="duotone" /> Webhook entrant WooCommerce</div>} className="mb-6">
        <div className="p-6 space-y-4">
          <div className="text-sm text-muted-foreground">
            Reçoit les commandes automatiquement depuis WordPress. Configurez ce webhook dans <span className="mono">WooCommerce → Réglages → Avancé → Webhooks</span>.
          </div>

          <div>
            <label className="label">URL du webhook</label>
            <div className="flex gap-2">
              <input className="input input-mono flex-1" readOnly value={webhookInfo?.url || ""} data-testid="webhook-url" />
              <button className="btn btn-secondary" onClick={() => copy(webhookInfo.url)} data-testid="copy-webhook-url">
                <Copy size={14} weight="bold" /> Copier
              </button>
            </div>
          </div>

          <div>
            <label className="label flex items-center justify-between">
              <span>Secret partagé</span>
              <button className="text-[10px] mono uppercase tracking-widest text-primary hover:underline" onClick={regenerate} data-testid="regenerate-secret">
                <ShuffleAngular size={11} weight="bold" className="inline" /> Régénérer & enregistrer
              </button>
            </label>
            <div className="flex gap-2">
              <input className="input input-mono flex-1" readOnly value={webhookInfo?.secret || ""} data-testid="webhook-secret" />
              <button className="btn btn-secondary" onClick={() => copy(webhookInfo.secret)} data-testid="copy-webhook-secret">
                <Copy size={14} weight="bold" /> Copier
              </button>
            </div>
            <div className="text-[10px] mono uppercase tracking-widest text-muted-foreground mt-1">
              Généré et enregistré automatiquement · Copiez-le dans WooCommerce
            </div>
          </div>

          <details className="border border-border p-4">
            <summary className="cursor-pointer font-heading font-bold text-[14px]">Instructions WordPress</summary>
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>WordPress admin → <span className="mono">WooCommerce → Réglages → Avancé → Webhooks</span></li>
              <li>Ajouter un webhook (créer 2 fois: "Commande créée" ET "Commande mise à jour")</li>
              <li>Statut : Actif · Sujet : sélectionner ci-dessus · Version API : <span className="mono">WP REST API Integration v3</span></li>
              <li>Coller l'URL et le secret ci-dessus · Enregistrer</li>
            </ol>
          </details>
        </div>
      </Card>

      {/* Outbound webhooks (n8n) */}
      <Card
        title={<div className="flex items-center gap-2"><PaperPlaneTilt size={18} weight="duotone" /> Webhooks sortants (n8n, Zapier, Make)</div>}
        className="mb-6"
        action={
          <button className="btn btn-primary" onClick={() => setShowAddOutbound(true)} data-testid="add-outbound-btn">
            <Plus size={14} weight="bold" /> Nouveau
          </button>
        }
      >
        <div className="p-6">
          <div className="text-sm text-muted-foreground mb-4">
            EuropaDrop enverra un POST à vos URLs quand ces événements se produisent : nouvelle commande, expédition, stock bas, produit publié, sync terminée…
          </div>

          <div className="table-wrap">
            <table className="data-table" data-testid="outbound-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>URL cible</th>
                  <th>Événements</th>
                  <th className="num">Livrés</th>
                  <th>Dernier statut</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {outbound.map((w) => (
                  <tr key={w.id}>
                    <td className="font-semibold">{w.name}</td>
                    <td className="mono text-[11px] max-w-xs truncate">{w.url}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {w.events.map(e => <span key={e} className="badge badge-neutral mono text-[10px]">{e}</span>)}
                      </div>
                    </td>
                    <td className="num">{w.deliveryCount || 0}<span className="text-critical text-[10px] ml-1">/{w.errorCount || 0}</span></td>
                    <td className="mono text-[11px]">
                      {w.lastStatus ? (
                        <span className={cn(w.lastStatus < 400 ? "text-success" : "text-critical")}>{w.lastStatus}</span>
                      ) : "—"}
                      {w.lastFiredAt && <div className="text-[10px] text-muted-foreground">{fmtDateTime(w.lastFiredAt)}</div>}
                    </td>
                    <td>{w.active ? <span className="badge badge-success">Actif</span> : <span className="badge badge-neutral">Pausé</span>}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-ghost text-[11px] py-1 px-2" onClick={() => testOutbound(w.id)} data-testid={`test-${w.id}`}>
                          <PaperPlaneTilt size={12} weight="bold" /> Test
                        </button>
                        <button className="btn btn-ghost text-[11px] py-1 px-2" onClick={() => toggleOutbound(w)}>
                          {w.active ? "Pauser" : "Activer"}
                        </button>
                        <button className="btn btn-ghost text-[11px] py-1 px-2 text-critical" onClick={() => delOutbound(w.id)}>
                          <Trash size={14} weight="bold" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {outbound.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Aucun webhook sortant. Ajoutez une URL n8n/Zapier/Make pour recevoir les événements.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* n8n integration */}
      {n8n && (
        <Card title={<div className="flex items-center gap-2"><Robot size={18} weight="duotone" /> Intégration n8n / API externe</div>} className="mb-6">
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <a href={n8n.swagger_docs} target="_blank" rel="noreferrer" className="border border-border p-4 hover:bg-muted transition-colors flex items-center justify-between" data-testid="swagger-link">
                <div>
                  <div className="h3 flex items-center gap-2"><Book size={16} weight="duotone" /> Documentation Swagger</div>
                  <div className="text-[11px] mono text-muted-foreground mt-1">/docs · exploration interactive de l'API</div>
                </div>
                <ArrowSquareOut size={16} weight="bold" className="text-muted-foreground" />
              </a>
              <a href={n8n.openapi_spec} target="_blank" rel="noreferrer" className="border border-border p-4 hover:bg-muted transition-colors flex items-center justify-between" data-testid="openapi-link">
                <div>
                  <div className="h3">Spec OpenAPI JSON</div>
                  <div className="text-[11px] mono text-muted-foreground mt-1">Importable directement dans n8n / Postman</div>
                </div>
                <ArrowSquareOut size={16} weight="bold" className="text-muted-foreground" />
              </a>
            </div>

            <details className="border border-border p-4">
              <summary className="cursor-pointer font-heading font-bold text-[14px]">Configuration dans n8n (5 étapes)</summary>
              <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                {n8n.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
              <div className="mt-4 p-3 bg-black text-white mono text-[11px] overflow-x-auto">
                {n8n.example_curl}
              </div>
            </details>
          </div>
        </Card>
      )}

      {/* Sync History */}
      <Card title="Historique des synchronisations">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th className="num">Produits MàJ</th>
                <th className="num">Synchronisés WC</th>
                <th className="num">Erreurs</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{fmtDateTime(h.createdAt)}</td>
                  <td><span className="badge badge-neutral mono">{h.type}</span></td>
                  <td className="num">{h.productsUpdated || 0}</td>
                  <td className="num text-success">{h.productsSynced || 0}</td>
                  <td className={`num ${h.errors ? "text-critical" : ""}`}>{h.errors || 0}</td>
                </tr>
              ))}
              {history.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Aucune sync exécutée.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {showAddOutbound && <AddOutboundModal events={events} onClose={() => setShowAddOutbound(false)} onSave={addOutbound} />}
    </div>
  );
}

function AddOutboundModal({ events, onClose, onSave }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState(new Set());

  const toggle = (e) => {
    const next = new Set(selected);
    next.has(e) ? next.delete(e) : next.add(e);
    setSelected(next);
  };

  const submit = () => {
    if (!name.trim() || !url.trim()) return toast.error("Nom et URL obligatoires");
    if (selected.size === 0) return toast.error("Sélectionnez au moins un événement");
    if (!/^https?:\/\//.test(url)) return toast.error("URL doit commencer par http(s)://");
    onSave({ name, url, events: [...selected], active: true });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full max-w-xl max-h-[90vh] overflow-y-auto border border-border fade-up" data-testid="add-outbound-modal">
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="h2">Nouveau webhook sortant</div>
          <button className="p-2 hover:bg-muted" onClick={onClose}><X size={18} weight="bold" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Nom</label>
            <input className="input" placeholder="ex: n8n Prod - Notifications commandes" value={name} onChange={(e) => setName(e.target.value)} data-testid="outbound-name" />
          </div>
          <div>
            <label className="label">URL cible (n8n webhook / Zapier / Make)</label>
            <input className="input input-mono" placeholder="https://n8n.mondomaine.com/webhook/..." value={url} onChange={(e) => setUrl(e.target.value)} data-testid="outbound-url" />
          </div>
          <div>
            <label className="label">Événements à envoyer ({selected.size})</label>
            <div className="border border-border p-3 max-h-64 overflow-y-auto space-y-1">
              {Object.entries(events).map(([k, desc]) => (
                <label key={k} className={cn(
                  "flex items-start gap-3 p-2 hover:bg-muted cursor-pointer",
                  selected.has(k) && "bg-blue-50"
                )}>
                  <input type="checkbox" checked={selected.has(k)} onChange={() => toggle(k)} className="mt-1" data-testid={`event-${k}`} />
                  <div>
                    <div className="mono text-[11px] font-bold">{k}</div>
                    <div className="text-[11px] text-muted-foreground">{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-border px-6 py-4 flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={submit} data-testid="outbound-save">Créer</button>
        </div>
      </div>
    </div>
  );
}
