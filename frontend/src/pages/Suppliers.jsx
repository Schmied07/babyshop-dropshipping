import { useEffect, useState } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { PageHeader, Card, Loading, StatusBadge } from "../components/Bits";
import { fmtDate } from "../lib/format";
import { Storefront, MapPin, Plus, X, Star, Truck, Trash, PencilSimple } from "@phosphor-icons/react";

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = () => {
    setLoading(true);
    api.get("/suppliers").then((r) => {
      setSuppliers(r.data.data || []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const save = async (form) => {
    try {
      if (editing?.id) {
        await api.put(`/suppliers/${editing.id}`, form);
        toast.success("Fournisseur mis à jour");
      } else {
        await api.post("/suppliers", form);
        toast.success("Fournisseur créé");
      }
      setShowModal(false);
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };

  const del = async (id) => {
    if (!window.confirm("Supprimer ce fournisseur ?")) return;
    try {
      await api.delete(`/suppliers/${id}`);
      toast.success("Fournisseur supprimé");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };

  return (
    <div className="p-8 lg:p-12 fade-up">
      <PageHeader
        title="Fournisseurs"
        subtitle={`${suppliers.length} fournisseurs européens actifs`}
        action={
          <button
            className="btn btn-primary"
            onClick={() => { setEditing(null); setShowModal(true); }}
            data-testid="add-supplier-btn"
          >
            <Plus size={14} weight="bold" /> Nouveau fournisseur
          </button>
        }
      />

      {loading ? <Loading /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <div key={s.id} className="card p-6 hover:border-primary transition-colors cursor-pointer group" data-testid={`supplier-card-${s.id}`} onClick={() => { setEditing(s); setShowModal(true); }}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="h3 mb-1">{s.name}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin size={12} weight="bold" /> {s.country}
                  </div>
                </div>
                {s.isActive ? <StatusBadge status="active" /> : <StatusBadge status="inactive" />}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <Stat label="Note" value={
                  <span className="flex items-center gap-1 mono">
                    <Star size={12} weight="fill" className="text-warning" /> {s.rating || "—"}
                  </span>
                } />
                <Stat label="Commande min" value={<span className="mono">{s.minOrderValue}€</span>} />
                <Stat label="Délai" value={<span className="mono">{s.leadTime?.min}-{s.leadTime?.max}j</span>} />
                <Stat label="Avis" value={<span className="mono">{s.reviews || 0}</span>} />
              </div>

              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground mono uppercase tracking-widest">
                  <Truck size={12} weight="bold" /> Expédie vers {s.shipping?.countries?.length || 0} pays
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="btn btn-ghost text-[11px] py-1 px-2"
                    onClick={(e) => { e.stopPropagation(); setEditing(s); setShowModal(true); }}
                    data-testid={`edit-supplier-${s.id}`}
                  >
                    <PencilSimple size={14} weight="bold" /> Modifier
                  </button>
                  <button
                    className="btn btn-ghost text-[11px] py-1 px-2 text-critical"
                    onClick={(e) => { e.stopPropagation(); del(s.id); }}
                    data-testid={`delete-supplier-${s.id}`}
                    aria-label="Supprimer"
                  >
                    <Trash size={14} weight="bold" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <SupplierModal
          supplier={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={save}
        />
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-widest mono mb-1">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function SupplierModal({ supplier, onClose, onSave }) {
  const [form, setForm] = useState({
    name: supplier?.name || "",
    country: supplier?.country || "France",
    website: supplier?.website || "",
    email: supplier?.email || "",
    phone: supplier?.phone || "",
    minOrderValue: supplier?.minOrderValue || 100,
    isActive: supplier?.isActive ?? true,
    rating: supplier?.rating || 4.5,
    catalogUrl: supplier?.catalogUrl || "",
  });

  const set = (k, v) => setForm({ ...form, [k]: v });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full max-w-xl max-h-[90vh] overflow-y-auto border border-border fade-up" data-testid="supplier-modal">
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="h2">{supplier ? "Modifier fournisseur" : "Nouveau fournisseur"}</div>
          <button className="p-2 hover:bg-muted" onClick={onClose}><X size={18} weight="bold" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nom</label>
              <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} data-testid="supplier-name" />
            </div>
            <div>
              <label className="label">Pays</label>
              <select className="input" value={form.country} onChange={(e) => set("country", e.target.value)}>
                {["France", "Belgium", "Netherlands", "Germany", "Spain", "Italy", "Portugal", "Austria", "Poland", "Switzerland"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input className="input input-mono" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Site web</label>
              <input className="input" value={form.website} onChange={(e) => set("website", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">URL catalogue B2B</label>
              <input className="input" value={form.catalogUrl} onChange={(e) => set("catalogUrl", e.target.value)} />
            </div>
            <div>
              <label className="label">Commande min (€)</label>
              <input type="number" className="input input-mono" value={form.minOrderValue} onChange={(e) => set("minOrderValue", Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Note (0-5)</label>
              <input type="number" step="0.1" min="0" max="5" className="input input-mono" value={form.rating} onChange={(e) => set("rating", Number(e.target.value))} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} />
            Fournisseur actif
          </label>
        </div>
        <div className="border-t border-border px-6 py-4 flex gap-2 justify-end">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={() => onSave(form)} data-testid="supplier-save">
            {supplier ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}
