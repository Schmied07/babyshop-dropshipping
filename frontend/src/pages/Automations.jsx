import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import { PageHeader, Card, Loading } from "../components/Bits";
import { fmtDateTime } from "../lib/format";
import { Broadcast, Clock, Copy, Play, ArrowsClockwise, DownloadSimple, CheckCircle } from "@phosphor-icons/react";

export default function Automations() {
  const [webhookInfo, setWebhookInfo] = useState(null);
  const [scheduler, setScheduler] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningJob, setRunningJob] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/webhooks/woocommerce/info"),
      api.get("/scheduler/status"),
      api.get("/scheduler/history"),
    ]).then(([w, s, h]) => {
      setWebhookInfo(w.data);
      setScheduler(s.data);
      setHistory(h.data.data || []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié dans le presse-papier");
  };

  const runNow = async (jobId) => {
    setRunningJob(jobId);
    try {
      await api.post(`/scheduler/run-now/${jobId}`);
      toast.success("Job lancé");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    } finally {
      setRunningJob(null);
    }
  };

  if (loading) return <div className="p-12"><Loading /></div>;

  return (
    <div className="p-8 lg:p-12 fade-up">
      <PageHeader
        title="Automatisations"
        subtitle="Webhooks WooCommerce · Synchronisation programmée"
      />

      {/* CRON Scheduler */}
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
                  <button
                    className="btn btn-secondary text-[11px]"
                    onClick={() => runNow(job.id)}
                    disabled={runningJob === job.id}
                    data-testid={`run-${job.id}`}
                  >
                    <Play size={12} weight="fill" />
                    {runningJob === job.id ? "En cours…" : "Lancer maintenant"}
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

      {/* Webhook */}
      <Card
        title={<div className="flex items-center gap-2"><Broadcast size={18} weight="duotone" /> Webhook WooCommerce</div>}
        className="mb-6"
      >
        <div className="p-6 space-y-4">
          <div className="text-sm text-muted-foreground">
            Configurez ce webhook dans WordPress pour importer automatiquement les nouvelles commandes en temps réel.
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
            <label className="label">Secret (à copier dans WooCommerce)</label>
            <div className="flex gap-2">
              <input className="input input-mono flex-1" readOnly value={webhookInfo?.secret || ""} data-testid="webhook-secret" />
              <button className="btn btn-secondary" onClick={() => copy(webhookInfo.secret)} data-testid="copy-webhook-secret">
                <Copy size={14} weight="bold" /> Copier
              </button>
            </div>
          </div>

          <div>
            <label className="label">Événements à écouter</label>
            <div className="flex gap-2">
              {webhookInfo?.events?.map((e) => (
                <span key={e} className="badge badge-primary mono">{e}</span>
              ))}
            </div>
          </div>

          <details className="border border-border p-4">
            <summary className="cursor-pointer font-heading font-bold text-[14px]">Instructions étape par étape</summary>
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Connectez-vous à votre WordPress admin.</li>
              <li>Allez dans <span className="mono">WooCommerce → Réglages → Avancé → Webhooks</span></li>
              <li>Cliquez sur <span className="mono font-bold">Ajouter un webhook</span></li>
              <li>Nom : <span className="mono">EuropaDrop - Commandes</span>, Statut : <span className="mono">Actif</span></li>
              <li>Sujet : <span className="mono">Commande créée</span> (créer aussi un second pour "Commande mise à jour")</li>
              <li>URL de livraison : coller l'URL ci-dessus</li>
              <li>Secret : coller le secret ci-dessus</li>
              <li>Version API : <span className="mono">WP REST API Integration v3</span></li>
              <li>Enregistrer. Les nouvelles commandes s'importent automatiquement.</li>
            </ol>
          </details>
        </div>
      </Card>

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
              {history.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Aucune sync exécutée. Lancez-en une manuellement.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
