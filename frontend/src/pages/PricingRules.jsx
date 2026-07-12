import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import { PageHeader, Card, Loading } from "../components/Bits";
import { fmtEUR, cn } from "../lib/format";
import { Plus, X, Trash, Percent, Lightning } from "@phosphor-icons/react";

export default function PricingRules() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/pricing-rules"),
      api.get("/suppliers"),
    ]).then(([r, s]) => {
      setRules(r.data.data || []);
      setSuppliers(s.data.data || []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const save = async (form) => {
    try {
      if (editing?.id) await api.put(`/pricing-rules/${editing.id}`, form);
      else await api.post("/pricing-rules", form);
      toast.success("Règle enregistrée");
      setShowModal(false); setEditing(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Erreur"); }
  };

  const del = async (id) => {
    if (!window.confirm("Supprimer cette règle ?")) return;
    await api.delete(`/pricing-rules/${id}`);
    toast.success("Règle supprimée"); load();
  };

  const applyAll = async () => {
    toast.promise(api.post("/pricing-rules/apply-all"), {
      loading: "Recalcul en cours…",
      success: (r) => `${r.data.updated} produits mis à jour`,
      error: "Erreur",
    });
  };

  return (
    <div className="p-8 lg:p-12 fade-up">
      <PageHeader
        title="Règles de tarification"
        subtitle="Markup automatique, arrondis, marge minimale"
        action={
          <>
            <button className="btn btn-secondary" onClick={applyAll} data-testid="apply-all-btn">
              <Lightning size={14} weight="bold" /> Recalculer tous les prix
            </button>
            <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }} data-testid="add-rule-btn">
              <Plus size={14} weight="bold" /> Nouvelle règle
            </button>
          </>
        }
      />

      {/* Preview simulator */}
      <div className="mb-8">
        <Simulator rules={rules} />
      </div>

      {loading ? <Loading /> : (
        <Card>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Catégorie</th>
                  <th>Fournisseur</th>
                  <th className="num">Markup</th>
                  <th>Arrondi</th>
                  <th className="num">Marge min</th>
                  <th className="num">Priorité</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold">{r.name}</td>
                    <td>{r.category || <span className="text-muted-foreground">Toutes</span>}</td>
                    <td>{r.supplierId ? suppliers.find(s => s.id === r.supplierId)?.name : <span className="text-muted-foreground">Tous</span>}</td>
                    <td className="num font-bold">+{r.markupPercent}%</td>
                    <td className="mono text-[11px]">{r.roundingRule}</td>
                    <td className="num">{fmtEUR(r.minMargin)}</td>
                    <td className="num">{r.priority}</td>
                    <td>{r.isActive ? <span className="badge badge-success">Actif</span> : <span className="badge badge-neutral">Inactif</span>}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-ghost text-[11px] py-1 px-2" onClick={() => { setEditing(r); setShowModal(true); }}>Modifier</button>
                        <button className="btn btn-ghost text-[11px] py-1 px-2 text-critical" onClick={() => del(r.id)}>
                          <Trash size={14} weight="bold" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rules.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">Aucune règle. Créez-en une pour automatiser le pricing.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showModal && <RuleModal rule={editing} suppliers={suppliers} onClose={() => { setShowModal(false); setEditing(null); }} onSave={save} />}
    </div>
  );
}

function Simulator({ rules }) {
  const [cost, setCost] = useState(2.5);
  const active = rules.filter(r => r.isActive);
  const apply = (r) => {
    let p = cost * (1 + r.markupPercent / 100);
    if (r.minMargin && (p - cost) < r.minMargin) p = cost + r.minMargin;
    if (r.roundingRule === "ends_99") p = Math.floor(p) + 0.99;
    else if (r.roundingRule === "ends_00") p = Math.round(p);
    else if (r.roundingRule === "nearest_10") p = Math.round(p / 10) * 10 - 0.01;
    return p;
  };

  return (
    <Card title="Simulateur de prix">
      <div className="p-6 flex items-center gap-6">
        <div>
          <label className="label">Coût simulé</label>
          <div className="flex items-center gap-2">
            <span className="mono">€</span>
            <input type="number" step="0.01" className="input input-mono w-32" value={cost} onChange={(e) => setCost(Number(e.target.value))} data-testid="simulator-cost" />
          </div>
        </div>
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
          {active.slice(0, 4).map(r => (
            <div key={r.id} className="border border-border p-3">
              <div className="text-[10px] uppercase tracking-widest mono text-muted-foreground mb-1">{r.name}</div>
              <div className="mono text-lg font-bold">{fmtEUR(apply(r))}</div>
              <div className="text-[10px] text-success mono">+{((apply(r) - cost) / cost * 100).toFixed(0)}%</div>
            </div>
          ))}
          {active.length === 0 && <div className="col-span-4 text-sm text-muted-foreground">Aucune règle active.</div>}
        </div>
      </div>
    </Card>
  );
}

function RuleModal({ rule, suppliers, onClose, onSave }) {
  const [form, setForm] = useState({
    name: rule?.name || "",
    category: rule?.category || "",
    supplierId: rule?.supplierId || "",
    markupPercent: rule?.markupPercent ?? 200,
    roundingRule: rule?.roundingRule || "ends_99",
    minMargin: rule?.minMargin ?? 1,
    priority: rule?.priority ?? 0,
    isActive: rule?.isActive ?? true,
  });
  const set = (k, v) => setForm({ ...form, [k]: v });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg border border-border fade-up" data-testid="rule-modal">
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="h2">{rule ? "Modifier règle" : "Nouvelle règle"}</div>
          <button className="p-2 hover:bg-muted" onClick={onClose}><X size={18} weight="bold" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Nom</label>
            <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} data-testid="rule-name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Catégorie (optionnel)</label>
              <select className="input" value={form.category || ""} onChange={(e) => set("category", e.target.value || null)}>
                <option value="">Toutes catégories</option>
                {["Hygiène", "Soins", "Bain", "Repas", "Déplacement"].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Fournisseur (optionnel)</label>
              <select className="input" value={form.supplierId || ""} onChange={(e) => set("supplierId", e.target.value || null)}>
                <option value="">Tous fournisseurs</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Markup (%)</label>
              <input type="number" className="input input-mono" value={form.markupPercent} onChange={(e) => set("markupPercent", Number(e.target.value))} data-testid="rule-markup" />
              <div className="text-[10px] mono uppercase tracking-widest text-muted-foreground mt-1">100 = ×2 · 200 = ×3</div>
            </div>
            <div>
              <label className="label">Arrondi</label>
              <select className="input" value={form.roundingRule} onChange={(e) => set("roundingRule", e.target.value)}>
                <option value="ends_99">Finit en ,99</option>
                <option value="ends_00">Entier</option>
                <option value="nearest_10">Proche de 10</option>
                <option value="none">Aucun</option>
              </select>
            </div>
            <div>
              <label className="label">Marge min (€)</label>
              <input type="number" step="0.1" className="input input-mono" value={form.minMargin} onChange={(e) => set("minMargin", Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Priorité</label>
              <input type="number" className="input input-mono" value={form.priority} onChange={(e) => set("priority", Number(e.target.value))} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} />
            Règle active
          </label>
        </div>
        <div className="border-t border-border px-6 py-4 flex gap-2 justify-end">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={() => onSave(form)} data-testid="rule-save">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
