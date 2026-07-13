import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Gear, FloppyDisk, CurrencyEur, Percent, Robot, CheckCircle, XCircle } from "@phosphor-icons/react";
import api from "../lib/api";
import { PageHeader, Card, Loading } from "../components/Bits";

const CURRENCIES = [
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "USD", symbol: "$", label: "Dollar US" },
  { code: "GBP", symbol: "£", label: "Livre Sterling" },
  { code: "CHF", symbol: "CHF", label: "Franc Suisse" },
];

export default function Settings() {
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [ds, setDs] = useState({ configured: false, hasKey: false, keyPreview: "" });
  const [dsKey, setDsKey] = useState("");
  const [dsSaving, setDsSaving] = useState(false);
  const [keepa, setKeepa] = useState({ configured: false, marketplaces: [] });
  const [keepaKey, setKeepaKey] = useState("");
  const [keepaSaving, setKeepaSaving] = useState(false);

  useEffect(() => {
    api.get("/settings").then((r) => setS(r.data.settings));
    api.get("/integrations/deepseek").then((r) => setDs(r.data)).catch(() => {});
    api.get("/integrations/keepa").then((r) => setKeepa(r.data)).catch(() => {});
  }, []);

  const saveDeepseek = async () => {
    if (!dsKey.trim()) { toast.error("Saisissez une clé DeepSeek"); return; }
    setDsSaving(true);
    try {
      const r = await api.put("/integrations/deepseek", { apiKey: dsKey.trim() });
      setDs({ ...ds, configured: r.data.configured, hasKey: true });
      setDsKey("");
      toast.success("Clé DeepSeek enregistrée");
      const info = await api.get("/integrations/deepseek");
      setDs(info.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur d'enregistrement");
    } finally {
      setDsSaving(false);
    }
  };

  const saveKeepa = async () => {
    if (!keepaKey.trim()) { toast.error("Saisissez une clé Keepa"); return; }
    setKeepaSaving(true);
    try {
      const r = await api.put("/integrations/keepa", { apiKey: keepaKey.trim() });
      toast.success(r.data.message || "Clé Keepa enregistrée");
      const info = await api.get("/integrations/keepa");
      setKeepa(info.data);
      setKeepaKey("");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur d'enregistrement");
    } finally {
      setKeepaSaving(false);
    }
  };

  const deleteKeepa = async () => {
    if (!window.confirm("Supprimer la clé Keepa ?")) return;
    try {
      await api.delete("/integrations/keepa");
      setKeepa({ configured: false, marketplaces: [] });
      toast.success("Clé Keepa supprimée");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur");
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.put("/settings", s);
      setS(r.data.settings);
      toast.success("Réglages enregistrés");
    } catch {
      toast.error("Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  if (!s) return <div className="p-12"><Loading /></div>;

  const rate = s.exchangeRates?.[s.currency] || 1;
  const sample = 42.99;
  const converted = (sample * rate).toFixed(2);
  const withVat = s.vatIncluded ? sample : (sample * (1 + s.vatRate / 100));

  return (
    <div className="p-8 lg:p-12 fade-up max-w-3xl">
      <PageHeader
        title="Réglages"
        subtitle="Devise d'affichage et TVA appliquées à votre boutique"
        action={
          <button className="btn btn-primary" onClick={save} disabled={saving} data-testid="settings-save-btn">
            <FloppyDisk size={14} weight="bold" /> {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        }
      />

      <Card title="Devise" className="mb-6">
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {CURRENCIES.map((c) => (
              <button
                key={c.code}
                onClick={() => setS({ ...s, currency: c.code, currencySymbol: c.symbol })}
                className={"border p-3 text-left transition-colors " + (s.currency === c.code ? "border-primary bg-blue-50" : "border-border hover:bg-muted")}
                data-testid={`currency-${c.code}`}
              >
                <div className="mono font-bold text-lg">{c.symbol}</div>
                <div className="text-[12px] font-semibold">{c.code}</div>
                <div className="text-[11px] text-muted-foreground">{c.label}</div>
              </button>
            ))}
          </div>
          <div className="text-[12px] text-muted-foreground flex items-center gap-2">
            <CurrencyEur size={14} weight="bold" />
            Taux vs EUR : <span className="mono font-semibold">{rate}</span> · Exemple : 42,99 € →{" "}
            <span className="mono font-semibold">{converted} {s.currencySymbol}</span>
          </div>
        </div>
      </Card>

      <Card title="TVA">
        <div className="p-5 space-y-5">
          <div>
            <label className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-2">
              <Percent size={13} weight="bold" /> Taux de TVA (%)
            </label>
            <input
              type="number"
              step="0.1"
              className="input max-w-[160px]"
              value={s.vatRate}
              onChange={(e) => setS({ ...s, vatRate: parseFloat(e.target.value) || 0 })}
              data-testid="vat-rate-input"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={s.vatIncluded}
              onChange={(e) => setS({ ...s, vatIncluded: e.target.checked })}
              data-testid="vat-included-checkbox"
              className="w-4 h-4"
            />
            <span className="text-[13px]">Les prix affichés incluent déjà la TVA (TTC)</span>
          </label>
          <div className="border border-border p-4 bg-muted/40 text-[12px]">
            <div className="uppercase tracking-widest text-[10px] text-muted-foreground mb-1">Aperçu</div>
            Prix HT de référence <span className="mono font-semibold">42,99 €</span> →{" "}
            <span className="mono font-semibold">{withVat.toFixed(2)} € {s.vatIncluded ? "TTC" : `TTC (TVA ${s.vatRate}%)`}</span>
          </div>
        </div>
      </Card>

      <Card title="Intelligence Artificielle (DeepSeek)" className="mt-6">
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-[13px]">
            {ds.configured ? (
              <><CheckCircle size={18} weight="fill" className="text-success" /> <span className="font-semibold text-success">Clé configurée</span>{ds.keyPreview && <span className="mono text-[11px] text-muted-foreground">{ds.keyPreview}</span>}</>
            ) : (
              <><XCircle size={18} weight="fill" className="text-critical" /> <span className="font-semibold text-critical">Aucune clé configurée</span></>
            )}
          </div>
          <p className="text-[12px] text-muted-foreground">
            La clé DeepSeek active la traduction FR, les descriptions SEO, les actions IA en masse et le mapping intelligent à l'import.
            Obtenez une clé sur <span className="mono">platform.deepseek.com</span>.
          </p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Robot size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" weight="bold" />
              <input
                type="password"
                className="input pl-9"
                placeholder="sk-..."
                value={dsKey}
                onChange={(e) => setDsKey(e.target.value)}
                data-testid="deepseek-key-input"
              />
            </div>
            <button className="btn btn-primary" onClick={saveDeepseek} disabled={dsSaving} data-testid="deepseek-save-btn">
              <FloppyDisk size={14} weight="bold" /> {dsSaving ? "Enregistrement…" : "Enregistrer la clé"}
            </button>
          </div>
        </div>
      </Card>

      <Card title="Keepa — Comparaison prix Amazon" className="mt-6">
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-[13px]">
            {keepa.configured ? (
              <>
                <CheckCircle size={18} weight="fill" className="text-success" />
                <span className="font-semibold text-success">Clé configurée</span>
                <span className="text-[11px] text-muted-foreground">
                  {keepa.marketplaces?.length || 0} marketplaces supportés
                </span>
              </>
            ) : (
              <>
                <XCircle size={18} weight="fill" className="text-critical" />
                <span className="font-semibold text-critical">Aucune clé configurée</span>
              </>
            )}
          </div>
          <p className="text-[12px] text-muted-foreground">
            Keepa permet de comparer vos prix fournisseurs avec les prix Amazon en temps réel pour identifier les meilleures opportunités de marge.
            Obtenez une clé API sur <span className="mono">keepa.com/#!api</span>.
          </p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Robot size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" weight="bold" />
              <input
                type="password"
                className="input pl-9"
                placeholder="Clé API Keepa..."
                value={keepaKey}
                onChange={(e) => setKeepaKey(e.target.value)}
                data-testid="keepa-key-input"
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={saveKeepa}
              disabled={keepaSaving}
              data-testid="keepa-save-btn"
            >
              <FloppyDisk size={14} weight="bold" />
              {keepaSaving ? "Enregistrement…" : "Enregistrer"}
            </button>
            {keepa.configured && (
              <button
                className="btn btn-ghost text-critical"
                onClick={deleteKeepa}
                data-testid="keepa-delete-btn"
              >
                <XCircle size={14} weight="bold" />
                Supprimer
              </button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
