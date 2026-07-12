import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import { PageHeader, Card, Loading, StatusBadge } from "../components/Bits";
import { fmtDate } from "../lib/format";
import { DownloadSimple, UploadSimple, ArrowRight, CheckCircle, XCircle, Files } from "@phosphor-icons/react";

const INTERNAL_FIELDS = [
  { key: "supplierSku", label: "SKU fournisseur *", required: true },
  { key: "name", label: "Nom du produit *", required: true },
  { key: "costPrice", label: "Prix de coût (€) *", required: true },
  { key: "stock", label: "Stock" },
  { key: "category", label: "Catégorie" },
  { key: "brand", label: "Marque" },
  { key: "ean", label: "EAN / GTIN" },
  { key: "moq", label: "MOQ (quantité min)" },
  { key: "packageQty", label: "Qté par carton" },
  { key: "leadTimeDays", label: "Délai (jours)" },
];

export default function ImportCatalog() {
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [step, setStep] = useState(1); // 1=upload, 2=map, 3=preview, 4=done
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/suppliers").then((r) => setSuppliers(r.data.data || []));
    api.get("/catalog/history").then((r) => setHistory(r.data.data || []));
  }, []);

  const onFile = async (f) => {
    if (!supplierId) { toast.error("Sélectionnez d'abord un fournisseur"); return; }
    setFile(f);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await api.post("/catalog/preview", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPreview(r.data);
      setMapping(r.data.suggested_mapping || {});
      setStep(2);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Fichier invalide");
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    setBusy(true);
    try {
      // Re-parse full file to get all rows (we only have preview rows, so send them + reparse server-side would be better)
      // For simplicity, re-upload
      const fd = new FormData();
      fd.append("file", file);
      const p = await api.post("/catalog/preview", fd, { headers: { "Content-Type": "multipart/form-data" } });
      // Server-side handles full parsing—but our preview only returns 5 rows. So we need to send them all.
      // We'll fetch full rows via a second endpoint or re-upload. We'll simulate by re-reading in preview endpoint.
      // Actually our preview endpoint returns only preview_rows. Let's send the whole via /catalog/import with rows.
      // To keep it simple: parse the file locally by re-reading + let backend re-parse. But we need to send rows.
      // Solution: keep it clean, upload once and send preview_rows only, but our backend expects `rows` parameter with all rows.
      // Let's call preview once more but request full rows via a special flag. Actually simpler:
      // We'll use a dedicated /catalog/import endpoint that accepts the file itself.
      // TODO: switching to file-based import.
      const fd2 = new FormData();
      fd2.append("file", file);
      fd2.append("supplierId", supplierId);
      fd2.append("mapping", JSON.stringify(mapping));
      const r = await api.post("/catalog/import-file", fd2, { headers: { "Content-Type": "multipart/form-data" } });
      setResult(r.data);
      setStep(4);
      api.get("/catalog/history").then((rr) => setHistory(rr.data.data || []));
      toast.success(`Import terminé : ${r.data.imported} créés, ${r.data.updated} mis à jour`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erreur d'import");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep(1); setFile(null); setPreview(null); setMapping({}); setResult(null);
  };

  return (
    <div className="p-8 lg:p-12 fade-up">
      <PageHeader
        title="Import catalogue fournisseur"
        subtitle="CSV · Excel · JSON · XML — mapping intelligent"
      />

      {/* Steps */}
      <div className="flex items-center gap-2 mb-8">
        {["Fichier", "Mapping", "Aperçu", "Résultat"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 flex items-center justify-center border ${step > i + 1 ? "bg-success text-white border-success" : step === i + 1 ? "bg-primary text-white border-primary" : "border-border text-muted-foreground"} mono text-xs font-bold`}>
              {step > i + 1 ? <CheckCircle size={16} weight="fill" /> : i + 1}
            </div>
            <div className={`text-xs uppercase tracking-widest mono font-bold ${step >= i + 1 ? "text-foreground" : "text-muted-foreground"}`}>{s}</div>
            {i < 3 && <ArrowRight size={14} className="text-muted-foreground" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <div className="p-6 space-y-6">
            <div>
              <label className="label">1. Sélectionner le fournisseur</label>
              <select
                className="input"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                data-testid="import-supplier-select"
              >
                <option value="">— Choisir un fournisseur —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.country})</option>)}
              </select>
            </div>

            <div>
              <label className="label">2. Téléverser le catalogue</label>
              <label className={`block border border-dashed border-border p-12 text-center cursor-pointer hover:border-primary transition-colors ${!supplierId ? "opacity-50 pointer-events-none" : ""}`} data-testid="import-dropzone">
                <UploadSimple size={40} weight="duotone" className="mx-auto text-muted-foreground mb-3" />
                <div className="font-heading font-bold text-lg mb-1">Glissez votre fichier ici</div>
                <div className="text-sm text-muted-foreground mb-4">Ou cliquez pour parcourir · CSV, XLSX, JSON, XML</div>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.json,.xml"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                  data-testid="import-file-input"
                />
                <div className="inline-block btn btn-primary">Parcourir…</div>
              </label>
              {busy && <div className="mt-3 text-sm mono text-primary">Analyse du fichier…</div>}
            </div>
          </div>
        </Card>
      )}

      {step === 2 && preview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Mapper les colonnes">
            <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
              {INTERNAL_FIELDS.map((f) => (
                <div key={f.key} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold">{f.label}</div>
                    <div className="text-[10px] mono uppercase tracking-widest text-muted-foreground">{f.key}</div>
                  </div>
                  <ArrowRight size={12} className="text-muted-foreground" />
                  <select
                    className="input w-56"
                    value={mapping[f.key] || ""}
                    onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                    data-testid={`mapping-${f.key}`}
                  >
                    <option value="">— Ignorer —</option>
                    {preview.columns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </Card>

          <Card title={`Aperçu (${preview.total_rows} lignes détectées)`}>
            <div className="p-4">
              <div className="table-wrap max-h-[400px] overflow-auto">
                <table className="data-table text-[11px]">
                  <thead>
                    <tr>
                      {preview.columns.slice(0, 6).map((c) => <th key={c}>{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview_rows.map((r, i) => (
                      <tr key={i}>
                        {preview.columns.slice(0, 6).map((c) => <td key={c} className="mono">{String(r[c] || "").slice(0, 30)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex justify-between">
                <button className="btn btn-secondary" onClick={reset}>Annuler</button>
                <button className="btn btn-primary" onClick={doImport} disabled={busy} data-testid="confirm-import">
                  {busy ? "Import en cours…" : `Importer ${preview.total_rows} produits`}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {step === 4 && result && (
        <Card>
          <div className="p-8 text-center">
            <CheckCircle size={48} weight="duotone" className="mx-auto text-success mb-4" />
            <div className="h2 mb-2">Import terminé</div>
            <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto my-6">
              <div className="border border-border p-4">
                <div className="mono text-3xl font-bold">{result.imported}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Créés</div>
              </div>
              <div className="border border-border p-4">
                <div className="mono text-3xl font-bold">{result.updated}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Mis à jour</div>
              </div>
              <div className="border border-border p-4">
                <div className="mono text-3xl font-bold text-critical">{result.errors?.length || 0}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Erreurs</div>
              </div>
            </div>
            {result.errors && result.errors.length > 0 && (
              <details className="max-w-xl mx-auto text-left mt-4">
                <summary className="cursor-pointer text-sm text-critical mono">Voir erreurs ({result.errors.length})</summary>
                <div className="mt-2 p-3 bg-muted text-xs mono">{result.errors.slice(0, 10).map((e, i) => <div key={i}>{e}</div>)}</div>
              </details>
            )}
            <button className="btn btn-primary mt-6" onClick={reset} data-testid="new-import">Nouvel import</button>
          </div>
        </Card>
      )}

      {/* History */}
      <div className="mt-8">
        <div className="h2 mb-4">Historique</div>
        <Card>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Fichier</th>
                  <th>Format</th>
                  <th className="num">Total</th>
                  <th className="num">Créés</th>
                  <th className="num">MàJ</th>
                  <th className="num">Erreurs</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{fmtDate(h.createdAt)}</td>
                    <td className="mono text-[11px]">{h.filename}</td>
                    <td><span className="badge badge-neutral">{h.format}</span></td>
                    <td className="num">{h.totalRows}</td>
                    <td className="num text-success">{h.imported}</td>
                    <td className="num">{h.updated}</td>
                    <td className={`num ${h.errors?.length ? "text-critical" : ""}`}>{h.errors?.length || 0}</td>
                    <td><StatusBadge status={h.status === "completed" ? "success" : h.status} /></td>
                  </tr>
                ))}
                {history.length === 0 && <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">Aucun import.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
