import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import { PageHeader, Card, Loading } from "../components/Bits";
import { fmtDateTime, cn } from "../lib/format";
import { User, Plus, X, Trash, ShieldCheck, UserGear } from "@phosphor-icons/react";
import { useAuth } from "../lib/auth";

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = () => {
    setLoading(true);
    api.get("/users").then((r) => {
      setUsers(r.data.data || []);
      setLoading(false);
    }).catch((e) => {
      toast.error(e.response?.data?.detail || "Erreur");
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const save = async (form) => {
    try {
      if (editing?.id) {
        await api.put(`/users/${editing.id}`, form);
        toast.success("Utilisateur mis à jour");
      } else {
        await api.post("/users", form);
        toast.success("Utilisateur créé");
      }
      setShowAdd(false);
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };

  const del = async (id) => {
    if (!window.confirm("Supprimer cet utilisateur ?")) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success("Supprimé");
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };

  if (me?.role !== "admin") {
    return (
      <div className="p-12 text-center">
        <ShieldCheck size={48} weight="duotone" className="mx-auto text-muted-foreground mb-3" />
        <div className="h2 mb-2">Accès réservé aux admins</div>
        <div className="text-sm text-muted-foreground">Seuls les administrateurs peuvent gérer les utilisateurs.</div>
      </div>
    );
  }

  return (
    <div className="p-8 lg:p-12 fade-up">
      <PageHeader
        title="Utilisateurs"
        subtitle={`${users.length} utilisateurs · Rôles : admin (contrôle total), opérateur (accès limité)`}
        action={
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowAdd(true); }} data-testid="add-user-btn">
            <Plus size={14} weight="bold" /> Nouvel utilisateur
          </button>
        }
      />

      {loading ? <Loading /> : (
        <Card>
          <div className="table-wrap">
            <table className="data-table" data-testid="users-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Rôle</th>
                  <th>Créé le</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary text-white flex items-center justify-center font-heading font-black text-sm">
                          {u.name?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div>
                          <div className="font-semibold text-[13px]">{u.name}</div>
                          {u.id === me?.id && <div className="text-[10px] text-primary uppercase tracking-widest mono">Vous</div>}
                        </div>
                      </div>
                    </td>
                    <td className="mono text-[12px]">{u.email}</td>
                    <td>
                      <span className={cn("badge", u.role === "admin" ? "badge-primary" : "badge-info")}>
                        {u.role === "admin" ? "Admin" : "Opérateur"}
                      </span>
                    </td>
                    <td className="text-xs">{fmtDateTime(u.created_at)}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-ghost text-[11px] py-1 px-2" onClick={() => { setEditing(u); setShowAdd(true); }}>Modifier</button>
                        {u.id !== me?.id && (
                          <button className="btn btn-ghost text-[11px] py-1 px-2 text-critical" onClick={() => del(u.id)}>
                            <Trash size={14} weight="bold" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showAdd && <UserModal user={editing} onClose={() => { setShowAdd(false); setEditing(null); }} onSave={save} />}
    </div>
  );
}

function UserModal({ user, onClose, onSave }) {
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    password: "",
    role: user?.role || "operator",
  });
  const set = (k, v) => setForm({ ...form, [k]: v });

  const submit = () => {
    if (!form.name || !form.email) return toast.error("Nom et email obligatoires");
    if (!user && !form.password) return toast.error("Mot de passe obligatoire à la création");
    const payload = { ...form };
    if (user && !form.password) delete payload.password;
    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md border border-border fade-up" data-testid="user-modal">
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="h2">{user ? "Modifier utilisateur" : "Nouvel utilisateur"}</div>
          <button className="p-2 hover:bg-muted" onClick={onClose}><X size={18} weight="bold" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Nom</label>
            <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} data-testid="user-name" />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email} onChange={(e) => set("email", e.target.value)} data-testid="user-email" />
          </div>
          <div>
            <label className="label">Mot de passe {user && <span className="text-[10px] text-muted-foreground">(vide = inchangé)</span>}</label>
            <input type="password" className="input input-mono" value={form.password} onChange={(e) => set("password", e.target.value)} data-testid="user-password" />
          </div>
          <div>
            <label className="label">Rôle</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "admin", label: "Admin", desc: "Contrôle total" },
                { key: "operator", label: "Opérateur", desc: "Accès limité" },
              ].map(r => (
                <button
                  key={r.key}
                  className={cn(
                    "border p-3 text-left",
                    form.role === r.key ? "border-primary bg-blue-50" : "border-border hover:bg-muted"
                  )}
                  onClick={() => set("role", r.key)}
                  data-testid={`role-${r.key}`}
                >
                  <div className="font-heading font-bold text-[14px]">{r.label}</div>
                  <div className="text-[11px] text-muted-foreground">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-border px-6 py-4 flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={submit} data-testid="user-save">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
