import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TrendUp, TrendDown, Plus, Trash, Warning, LinkSimple, X } from "@phosphor-icons/react";
import api from "../lib/api";
import { fmtEUR, cn } from "../lib/format";
import { PageHeader, Card, Loading, EmptyState } from "../components/Bits";

export default function PriceWatch() {
  const [rows, setRows] = useState([]);
  const [alertsCount, setAlertsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/competitor-prices").then((r) => {
      setRows(r.data.data || []);
      setAlertsCount(r.data.alertsCount || 0);
      setLoading(false);
    });
  };
  useEffect(() => { load(); }, []);

  const del = (id) => {
    toast.promise(api.delete(`/competitor-prices/${id}`).then(load), {
      loading: "Suppression…", success: "Supprimé", error: "Erreur",
    });
  };

  return (
    <div className="p-8 lg:p-12 fade-up">
      <PageHeader
        title="Veille prix concurrents"
        subtitle={`${rows.length} prix suivis · ${alertsCount} alerte(s) où nous sommes plus chers`}
        action={
          <button className="btn btn-primary" onClick={() => setShowAdd(true)} data-testid="add-competitor-btn">
            <Plus size={14} weight="bold" /> Ajouter un prix
          </button>
        }
      />

      {alertsCount > 0 && (
        <div className="border border-amber-300 bg-amber-50 p-4 mb-6 flex items-center gap-3" data-testid="price-alert-banner">
          <Warning size={20} weight="fill" className="text-amber-600" />
          <div className="text-[13px]">
            <span className="font-bold">{alertsCount} produit(s)</span> sont vendus moins cher par la concurrence.
            Ajustez vos prix pour rester compétitif.
          </div>
        </div>
      )}

      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Aucun prix concurrent suivi"
          hint="Ajoutez le prix d'un concurrent pour recevoir une alerte quand vous êtes plus cher."
          action={<button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={14} weight="bold" /> Ajouter</button>}
        />
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="data-table" data-testid="competitor-table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Concurrent</th>
                  <th className="num">Notre prix</th>
                  <th className="num">Prix concurrent</th>
                  <th className="num">Écart</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={!r.isCheaper ? "bg-amber-50/60" : ""}>
                    <td>
                      <div className="font-semibold text-[13px]">{r.productName}</div>
                      <div className="mono text-[11px] text-muted-foreground">{r.productSku}</div>
                    </td>
                    <td>
                      <div className="text-[13px] font-semibold">{r.competitorName}</div>
                      {r.competitorUrl && (
                        <a href={r.competitorUrl} target="_blank" rel="noreferrer" className="text-[11px] text-primary flex items-center gap-1">
                          <LinkSimple size={11} /> lien
                        </a>
                      )}
                    </td>
                    <td className="num font-bold">{fmtEUR(r.ourPrice)}</td>
                    <td className="num">{fmtEUR(r.competitorPrice)}</td>
                    <td className={cn("num font-semibold", r.diff > 0 ? "text-critical" : "text-success")}>
                      {r.diff > 0 ? "+" : ""}{fmtEUR(r.diff)}
                    </td>
                    <td>
                      {r.isCheaper ? (
                        <span className="badge badge-success flex items-center gap-1 w-fit"><TrendDown size={12} weight="bold" /> Compétitif</span>
                      ) : (
                        <span className="badge badge-warning flex items-center gap-1 w-fit"><TrendUp size={12} weight="bold" /> Plus cher</span>
                      )}
                    </td>
                    <td>
                      <button className="p-2 hover:bg-muted text-muted-foreground hover:text-critical" onClick={() => del(r.id)} data-testid={`del-competitor-${r.id}`} aria-label="Supprimer">
                        <Trash size={15} weight="bold" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showAdd && <AddModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function AddModal({ onClose, onSaved }) {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ productId: "", competitorName: "", competitorUrl: "", competitorPrice: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/products", { params: { limit: 200 } }).then((r) => setProducts(r.data.data || []));
  }, []);

  const submit = async () => {
    if (!form.productId || !form.competitorName || !form.competitorPrice) {
      toast.error("Produit, concurrent et prix requis");
      return;
    }
    setSaving(true);
    try {
      await api.post("/competitor-prices", { ...form, competitorPrice: parseFloat(form.competitorPrice) });
      toast.success("Prix concurrent ajouté");
      onSaved();
    } catch {
      toast.error("Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="add-competitor-modal">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white border border-border fade-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="h3">Ajouter un prix concurrent</div>
          <button className="p-2 hover:bg-muted" onClick={onClose}><X size={18} weight="bold" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Produit</label>
            <select className="input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} data-testid="competitor-product-select">
              <option value="">— Choisir —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Nom du concurrent</label>
            <input className="input" value={form.competitorName} onChange={(e) => setForm({ ...form, competitorName: e.target.value })} placeholder="Amazon, Aubert…" data-testid="competitor-name-input" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">URL (optionnel)</label>
            <input className="input" value={form.competitorUrl} onChange={(e) => setForm({ ...form, competitorUrl: e.target.value })} placeholder="https://…" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Prix concurrent (€)</label>
            <input type="number" step="0.01" className="input" value={form.competitorPrice} onChange={(e) => setForm({ ...form, competitorPrice: e.target.value })} data-testid="competitor-price-input" />
          </div>
          <button className="btn btn-primary w-full" onClick={submit} disabled={saving} data-testid="competitor-submit-btn">
            {saving ? "Enregistrement…" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}
