import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Gear, FloppyDisk, CurrencyEur, Percent } from "@phosphor-icons/react";
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

  useEffect(() => {
    api.get("/settings").then((r) => setS(r.data.settings));
  }, []);

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
    </div>
  );
}
