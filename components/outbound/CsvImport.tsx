"use client";

import { useRef, useState } from "react";
import { IMPORT_FIELDS, FIELD_LABELS, IMPORT_MAX_BYTES, type ImportField, type ImportReport } from "@/lib/outbound/csvImport";

type Preview = { headers: string[]; suggested: Record<string, ImportField>; sample: string[][]; totalRows: number; truncated: boolean };
type Props = {
  /** Where the requests go: the customer onboarding API or the team outbound API (needs businessId). */
  target: { kind: "onboarding" } | { kind: "team"; businessId: string };
  dark?: boolean;
  onImported?: (r: { importId: string; report: ImportReport; filename: string }) => void;
};

const REASON_LABEL: Record<keyof ImportReport["reasons"], string> = { invalid_email: "no valid email", missing_name: "no name or company", duplicate_in_file: "repeated in the file", duplicate_existing: "already on your list", error: "couldn't be saved" };

/** Upload your own list: choose file → map columns (preview of first rows) → import → honest counts. 0 credits. */
export default function CsvImport({ target, dark = false, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState<string | null>(null); const [csv, setCsv] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null); const [mapping, setMapping] = useState<Record<string, ImportField>>({});
  const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null); const [report, setReport] = useState<ImportReport | null>(null);

  const post = async (body: Record<string, unknown>) => {
    const r = target.kind === "onboarding"
      ? await fetch("/api/dashboard/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/team/outbound", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ business_id: target.businessId, ...body }) });
    const j = await r.json(); if (!r.ok) throw new Error(j.error || "Request failed."); return j;
  };
  const pick = async (f: File | undefined) => {
    if (!f) return; setErr(null); setReport(null); setPreview(null);
    if (f.size > IMPORT_MAX_BYTES) { setErr("That file is over 2 MB — split it and upload in parts."); return; }
    const text = await f.text(); setFilename(f.name); setCsv(text); setBusy("preview");
    try {
      const j = target.kind === "onboarding" ? await post({ action: "leads_import_preview", data: { csv: text } }) : await post({ action: "import_csv_preview", csv: text });
      setPreview(j.preview); setMapping(j.preview.suggested);
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't read that file."); } finally { setBusy(null); }
  };
  const run = async () => {
    if (!csv || !preview) return; setBusy("import"); setErr(null);
    try {
      const j = target.kind === "onboarding" ? await post({ action: "leads_import_commit", data: { csv, filename, mapping } }) : await post({ action: "import_csv", csv, filename, mapping });
      setReport(j.report); setPreview(null); setCsv(null); if (fileRef.current) fileRef.current.value = "";
      onImported?.({ importId: j.importId, report: j.report, filename: filename ?? "upload.csv" });
    } catch (e) { setErr(e instanceof Error ? e.message : "Import failed."); } finally { setBusy(null); }
  };

  const t = dark
    ? { text: "text-[#F5F5F7]", muted: "text-[#A1A1A6]", faint: "text-[#6E6E73]", box: "border border-white/[0.1] bg-[#0F0F0F]", select: "bg-[#0F0F0F] text-[#F5F5F7] border border-white/[0.14]", primary: "bg-white text-black", ghost: "border border-white/[0.14] text-[#F5F5F7]", ok: "text-[#30D158]", bad: "text-[#FF6961]", cell: "border-white/[0.06]" }
    : { text: "text-neutral-900", muted: "text-neutral-600", faint: "text-neutral-400", box: "border border-neutral-200 bg-white", select: "bg-white text-neutral-900 border border-neutral-300", primary: "bg-neutral-900 text-white", ghost: "border border-neutral-300 text-neutral-900", ok: "text-emerald-700", bad: "text-red-600", cell: "border-neutral-100" };
  const mapped = (f: ImportField) => Object.values(mapping).includes(f);
  const ready = mapped("email") && (mapped("name") || mapped("company") || mapped("first_name") || mapped("last_name"));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busy} className={`h-[40px] px-5 rounded-full text-[13.5px] font-medium disabled:opacity-50 ${t.ghost}`}>{busy === "preview" ? "Reading…" : "Upload your own list (CSV)"}</button>
        <span className={`text-[12px] ${t.faint}`}>Name and email at minimum; company, phone, website and anything else come along. Importing is free.</span>
      </div>

      {preview && (
        <div className={`rounded-2xl p-4 flex flex-col gap-3 ${t.box}`}>
          <div className={`text-[13.5px] font-semibold ${t.text}`}>Match your columns <span className={`font-normal ${t.muted}`}>— {filename} · {preview.totalRows.toLocaleString()} rows{preview.truncated ? " (first 5,000 kept)" : ""}</span></div>
          <div className="overflow-x-auto">
            <table className="text-[12px] min-w-full">
              <thead><tr>{preview.headers.map((h) => (
                <th key={h} className={`text-left align-top px-2 py-1.5 border-b ${t.cell}`}>
                  <div className={`font-medium truncate max-w-[180px] ${t.text}`} title={h}>{h}</div>
                  <select value={mapping[h] ?? "ignore"} onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value as ImportField }))} className={`mt-1 h-[30px] rounded-[7px] px-2 text-[12px] w-full max-w-[180px] ${t.select}`}>
                    {IMPORT_FIELDS.map((f) => <option key={f} value={f}>{FIELD_LABELS[f]}</option>)}
                  </select>
                </th>))}</tr></thead>
              <tbody>{preview.sample.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={`px-2 py-1.5 border-b truncate max-w-[180px] ${t.cell} ${mapping[preview.headers[j]] === "ignore" ? t.faint : t.muted}`} title={c}>{c || <span className={t.faint}>—</span>}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <div className={`text-[12px] ${t.faint}`}>Showing the first {preview.sample.length} rows. Rows without a valid email or a name are skipped and counted; duplicates (in the file or already on your list) are skipped once.</div>
          <div className="flex items-center gap-3 flex-wrap">
            <button type="button" onClick={run} disabled={!ready || !!busy} className={`h-[40px] px-5 rounded-full text-[13.5px] font-semibold disabled:opacity-50 ${t.primary}`}>{busy === "import" ? "Importing…" : `Import ${preview.totalRows.toLocaleString()} rows →`}</button>
            <button type="button" onClick={() => { setPreview(null); setCsv(null); if (fileRef.current) fileRef.current.value = ""; }} className={`h-[40px] px-4 rounded-full text-[13px] ${t.ghost}`}>Cancel</button>
            {!ready && <span className={`text-[12px] ${t.bad}`}>Map an Email column and a name or company column to continue.</span>}
          </div>
        </div>
      )}

      {report && (
        <div className={`rounded-2xl p-4 ${t.box}`}>
          <div className={`text-[13.5px] font-semibold ${t.text}`}><span className={t.ok}>{report.imported.toLocaleString()} imported</span> · {report.skipped.toLocaleString()} skipped of {report.total.toLocaleString()} rows</div>
          {report.skipped > 0 && <ul className={`mt-1.5 text-[12.5px] ${t.muted} flex flex-col gap-0.5`}>{(Object.keys(report.reasons) as (keyof ImportReport["reasons"])[]).filter((k) => report.reasons[k] > 0).map((k) => <li key={k}>{report.reasons[k]} {REASON_LABEL[k]}{report.examples[k]?.length ? <span className={t.faint}> (e.g. {report.examples[k]!.join(", ")})</span> : null}</li>)}</ul>}
          <div className={`mt-1.5 text-[12px] ${t.faint}`}>Tagged “Uploaded · {filename}” so you can tell them apart from leads your agent found.</div>
        </div>
      )}
      {err && <div className={`text-[13px] ${t.bad}`}>{err}</div>}
    </div>
  );
}
