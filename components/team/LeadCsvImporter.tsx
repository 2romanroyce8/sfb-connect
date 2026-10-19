"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { LEAD_FIELDS, LEAD_FIELD_LABELS, type LeadField, type LeadMapping } from "@/lib/crm/leadImport";

// CSV lead importer (Roman, 2026-10-18): upload → map columns → preview + validation → duplicates →
// tags / stage / assignment → import with progress → report. Nothing is dropped silently: every
// skipped or errored row is in the report with its CSV row number and reason.
type Team = { id: string; full_name: string | null; email: string; team_role: string };
type Prefs = { mapping: LeadMapping; options: { tags?: string[]; stage?: string; assignment?: { column: string; map: Record<string, string> } | null; rangeTags?: { lastN: number; tags: string[] } | null } } | null;
type Preview = { headers: string[]; mapping: LeadMapping; mappingProblem: string | null; totalRows: number; truncated: boolean; preview: { row: number; business_name: string; website: string | null; city: string | null; state: string | null; phone: string | null; email: string | null; notes: string | null; tags: string[]; group: string | null }[]; issues: { row: number; name: string; reason: string }[]; validCount: number; duplicates: { key: string; why: string[]; rows: { row: number; business_name: string; city: string | null; phone: string | null }[]; existing: { id: string; business_name: string | null; phone_normalized: string | null }[] }[]; groupValues: string[]; customColumns: string[] };
type Outcome = { total: number; imported: number; merged_in_file: number; merged_existing: number; skipped: number; errored: number; unassigned: number; lines: { row: number; name: string; status: string; reason: string }[] };
const STAGE_LABEL: Record<string, string> = { demo_requested: "Book Demo (Pending)", new: "New", researching: "Researching", ready_to_call: "Ready to Call", contacted: "Contacted", interested: "Interested", follow_up: "Follow-Up", meeting_booked: "Meeting Booked", proposal: "Proposal", won: "Won", lost: "Lost", nurture: "Nurture" };
const REASON_LABEL: Record<string, string> = { missing_name: "Business name is blank", missing_phone: "Phone is blank", invalid_phone: "Phone is not a valid 10-digit US number", invalid_email: "Email is not valid" };
const card: React.CSSProperties = { background: "var(--hx-0a0a0a)", border: "1px solid rgb(var(--w) / 0.08)" };
const input: React.CSSProperties = { background: "var(--hx-101010)", border: "1px solid rgb(var(--w) / 0.1)", color: "var(--hx-f5f5f7)" };
const fmtPhone = (p: string | null) => (p && p.length === 10 ? `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}` : p ?? "");

export default function LeadCsvImporter() {
  const [meta, setMeta] = useState<{ prefs: Prefs; team: Team[]; stages: string[]; existingCount: number; maxBytes: number } | null>(null);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [mapping, setMapping] = useState<LeadMapping>({});
  const [pv, setPv] = useState<Preview | null>(null); const [loading, setLoading] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, "merge" | "skip">>({});
  const [tags, setTags] = useState(""); const [rangeN, setRangeN] = useState(""); const [rangeTags, setRangeTags] = useState("");
  const [stage, setStage] = useState("new"); const [assignCol, setAssignCol] = useState<string>(""); const [assignMap, setAssignMap] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null); const [outcome, setOutcome] = useState<{ importId: string; outcome: Outcome } | null>(null);
  const [drag, setDrag] = useState(false); const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetch("/api/team/leads/csv", { cache: "no-store" }).then((r) => r.json()).then((j) => { setMeta(j); const o = j.prefs?.options ?? {}; if (o.tags?.length) setTags(o.tags.join(", ")); if (o.stage) setStage(o.stage); if (o.rangeTags) { setRangeN(String(o.rangeTags.lastN)); setRangeTags(o.rangeTags.tags.join(", ")); } if (o.assignment) { setAssignCol(o.assignment.column); setAssignMap(o.assignment.map); } }).catch(() => setErr("Could not load importer settings.")); }, []);

  const runPreview = useCallback(async (text: string, m: LeadMapping | null) => {
    setLoading(true); setErr(null);
    try { const r = await fetch("/api/team/leads/csv", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "preview", csv: text, mapping: m }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "Preview failed."); setPv(j); setMapping(j.mapping); setDecisions((d) => { const n = { ...d }; for (const g of j.duplicates) if (!n[g.key]) n[g.key] = "merge"; return n; }); if (!assignCol && j.groupValues.length) setAssignCol("group"); }
    catch (e) { setErr(e instanceof Error ? e.message : "Preview failed."); } finally { setLoading(false); }
  }, [assignCol]);

  const onFile = async (f: File) => {
    if (!/\.csv$/i.test(f.name) && f.type !== "text/csv") { setErr("Choose a .csv file."); return; }
    if (meta && f.size > meta.maxBytes) { setErr(`File is over ${Math.round(meta.maxBytes / 1024 / 1024)} MB.`); return; }
    const text = await f.text(); setFile({ name: f.name, text }); setOutcome(null); setProgress(null);
    // Remembered mapping applies only to headers present in this file; the rest are guessed server-side.
    const remembered = meta?.prefs?.mapping ?? {}; const headerLine = text.split(/\r?\n/, 1)[0] ?? "";
    const m: LeadMapping = {}; for (const [h, f2] of Object.entries(remembered)) if (headerLine.includes(h)) m[h] = f2;
    await runPreview(text, Object.keys(m).length ? m : null);
  };
  const remap = (h: string, f: LeadField) => { const m = { ...mapping, [h]: f }; setMapping(m); if (file) void runPreview(file.text, m); };

  const assignValues = useMemo(() => { if (!pv) return [] as string[]; if (assignCol === "group") return pv.groupValues; if (!assignCol) return []; return Array.from(new Set(pv.preview.map(() => ""))).filter(Boolean); }, [pv, assignCol]);
  const canImport = !!pv && !pv.mappingProblem && pv.validCount > 0 && !loading && !progress;

  const commit = async () => {
    if (!file || !pv) return; setErr(null); setProgress({ done: 0, total: pv.totalRows }); setOutcome(null);
    const options = { filename: file.name, tags: tags.split(/[,;]/).map((t) => t.trim()).filter(Boolean), rangeTags: Number(rangeN) > 0 ? { lastN: Number(rangeN), tags: rangeTags.split(/[,;]/).map((t) => t.trim()).filter(Boolean) } : null, stage, assignment: assignCol && Object.values(assignMap).some(Boolean) ? { column: assignCol, map: Object.fromEntries(Object.entries(assignMap).filter(([, v]) => v)) } : null, decisions, savePrefs: true };
    try {
      const r = await fetch("/api/team/leads/csv", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "commit", csv: file.text, mapping, options }) });
      if (!r.ok || !r.body) { const j = await r.json().catch(() => ({})); throw new Error(j.error || "Import failed to start."); }
      const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "";
      for (;;) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true }); const parts = buf.split("\n\n"); buf = parts.pop() || ""; for (const p of parts) { if (!p.startsWith("data:")) continue; const evt = JSON.parse(p.slice(5)); if (evt.type === "progress") setProgress({ done: evt.done, total: evt.total }); else if (evt.type === "done") { setOutcome({ importId: evt.importId, outcome: evt.outcome }); setProgress(null); } else if (evt.type === "error") throw new Error(evt.error); } }
    } catch (e) { setErr(e instanceof Error ? e.message : "Import failed."); setProgress(null); }
  };
  const downloadReport = () => { if (!outcome) return; const lines = [["row", "business", "status", "reason"].join(","), ...outcome.outcome.lines.map((l) => [l.row, `"${l.name.replace(/"/g, '""')}"`, l.status, `"${l.reason.replace(/"/g, '""')}"`].join(","))]; const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" })); a.download = `import-report-${outcome.importId.slice(0, 8)}.csv`; a.click(); };

  const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => <section className="rounded-[12px] p-5" style={card}><div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[color:var(--hx-6e6e73)] mb-1">Step {n}</div><h2 className="text-[15px] font-semibold text-[color:var(--hx-f5f5f7)] mb-3">{title}</h2>{children}</section>;

  return (
    <div className="px-8 py-8 max-w-[1100px] flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4"><div><h1 className="text-[20px] font-semibold text-[color:var(--hx-f5f5f7)]">Upload leads from a CSV</h1><p className="text-[13px] text-[color:var(--hx-6e6e73)] mt-1">Business name and phone are required. Phones are normalized; duplicates (same phone or same company name) are shown before anything is written. {meta ? `${meta.existingCount} leads in the CRM now.` : ""}</p></div><Link href="/team/leads" className="text-[12.5px] text-[color:var(--hx-a1a1a6)] underline underline-offset-2">Back to Leads</Link></div>
      {err && <div className="rounded-[10px] px-4 py-3 text-[13px]" style={{ background: "rgb(var(--hx-ff453ac) / 0.1)", color: "var(--hx-ff453a)", border: "1px solid rgb(var(--hx-ff453ac) / 0.3)" }}>{err}</div>}

      <Step n={1} title="Choose the file">
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) void onFile(f); }} onClick={() => fileRef.current?.click()} role="button" tabIndex={0} className="rounded-[12px] p-8 flex flex-col items-center justify-center text-center cursor-pointer" style={{ border: `1px dashed ${drag ? "var(--hx-30d158)" : "rgb(var(--w) / 0.18)"}`, background: drag ? "rgb(var(--hx-30d158c) / 0.06)" : "var(--hx-050505)" }}>
          {file ? <FileSpreadsheet size={22} className="text-[color:var(--hx-30d158)]" /> : <Upload size={22} className="text-[color:var(--hx-a1a1a6)]" />}
          <div className="mt-2 text-[14px] text-[color:var(--hx-f5f5f7)]">{file ? file.name : "Drop a .csv here or click to choose"}</div>
          <div className="text-[12px] text-[color:var(--hx-6e6e73)] mt-1">{pv ? `${pv.totalRows} data rows · ${pv.headers.length} columns${pv.truncated ? " · truncated at the row limit" : ""}` : "Up to 2 MB · 5,000 rows"}</div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.currentTarget.value = ""; }} />
        </div>
      </Step>

      {pv && (
        <Step n={2} title="Map the columns">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {pv.headers.map((h) => <label key={h} className="flex flex-col gap-1 text-[12px] text-[color:var(--hx-a1a1a6)]"><span className="font-mono truncate" title={h}>{h}</span><select value={mapping[h] ?? "ignore"} onChange={(e) => remap(h, e.target.value as LeadField)} className="h-[36px] rounded-[8px] px-2 text-[13px]" style={input}>{LEAD_FIELDS.map((f) => <option key={f} value={f}>{LEAD_FIELD_LABELS[f]}</option>)}</select></label>)}
          </div>
          {pv.mappingProblem ? <div className="mt-3 text-[13px] text-[color:var(--hx-ff453a)]">{pv.mappingProblem}</div> : <div className="mt-3 text-[12px] text-[color:var(--hx-6e6e73)]">{meta?.prefs ? "Your last mapping was applied where the headers matched." : "This mapping is remembered for next time."}</div>}
        </Step>
      )}

      {pv && !pv.mappingProblem && (
        <Step n={3} title={`Preview & validation — ${pv.validCount} of ${pv.totalRows} rows pass`}>
          <div className="overflow-x-auto rounded-[10px]" style={{ border: "1px solid rgb(var(--w) / 0.08)" }}>
            <table className="w-full text-[12.5px]"><thead><tr className="text-left text-[color:var(--hx-6e6e73)]">{["Row", "Business", "Phone", "City", "State", "Website", "Email", "Group", "Tags", "Notes"].map((c) => <th key={c} className="px-3 py-2 font-medium">{c}</th>)}</tr></thead>
              <tbody>{pv.preview.map((r) => <tr key={r.row} style={{ borderTop: "1px solid rgb(var(--w) / 0.06)" }} className="text-[color:var(--hx-f5f5f7)]"><td className="px-3 py-2 text-[color:var(--hx-6e6e73)]">{r.row}</td><td className="px-3 py-2">{r.business_name}</td><td className="px-3 py-2 font-mono">{fmtPhone(r.phone)}</td><td className="px-3 py-2">{r.city}</td><td className="px-3 py-2">{r.state}</td><td className="px-3 py-2 max-w-[160px] truncate">{r.website}</td><td className="px-3 py-2 max-w-[160px] truncate">{r.email}</td><td className="px-3 py-2">{r.group}</td><td className="px-3 py-2">{r.tags.join(", ")}</td><td className="px-3 py-2 max-w-[200px] truncate" title={r.notes ?? ""}>{r.notes}</td></tr>)}</tbody></table>
          </div>
          {pv.issues.length > 0 && <div className="mt-3 rounded-[10px] p-3" style={{ background: "rgb(var(--hx-ffd60ac) / 0.08)", border: "1px solid rgb(var(--hx-ffd60ac) / 0.3)" }}><div className="flex items-center gap-2 text-[13px] text-[color:var(--hx-ffd60a)]"><AlertTriangle size={14} />{pv.issues.length} row{pv.issues.length === 1 ? "" : "s"} will be reported as errors and not imported:</div><ul className="mt-2 text-[12.5px] text-[color:var(--hx-a1a1a6)] max-h-[160px] overflow-y-auto">{pv.issues.map((i) => <li key={i.row}>Row {i.row} · {i.name} — {REASON_LABEL[i.reason] ?? i.reason}</li>)}</ul></div>}
        </Step>
      )}

      {pv && !pv.mappingProblem && pv.duplicates.length > 0 && (
        <Step n={4} title={`Duplicates — ${pv.duplicates.length} group${pv.duplicates.length === 1 ? "" : "s"}`}>
          <p className="text-[12.5px] text-[color:var(--hx-6e6e73)] mb-3">Merge keeps one lead (first row wins, blanks filled from the others, both cities kept, tags combined). Skip reports every row of the group as skipped.</p>
          <div className="flex flex-col gap-2">{pv.duplicates.map((g) => <div key={g.key} className="rounded-[10px] p-3 flex flex-wrap items-start justify-between gap-3" style={{ background: "var(--hx-050505)", border: "1px solid rgb(var(--w) / 0.08)" }}><div className="text-[12.5px] text-[color:var(--hx-f5f5f7)]"><div className="text-[11px] uppercase tracking-wide text-[color:var(--hx-6e6e73)]">Same {g.why.join(" + ")}</div>{g.rows.map((r) => <div key={r.row}>Row {r.row} · {r.business_name}{r.city ? ` · ${r.city}` : ""} · {fmtPhone(r.phone)}</div>)}{g.existing.map((e) => <div key={e.id} className="text-[color:var(--hx-a1a1a6)]">Existing lead · {e.business_name ?? e.id.slice(0, 8)} · {fmtPhone(e.phone_normalized)}</div>)}</div><div className="flex gap-1.5">{(["merge", "skip"] as const).map((d) => <button key={d} type="button" onClick={() => setDecisions((x) => ({ ...x, [g.key]: d }))} className="h-[30px] px-3 rounded-full text-[12px] font-semibold" style={{ background: decisions[g.key] === d ? "rgb(var(--w))" : "transparent", color: decisions[g.key] === d ? "rgb(var(--k))" : "var(--hx-a1a1a6)", border: "1px solid rgb(var(--w) / 0.14)" }}>{d === "merge" ? "Merge" : "Skip"}</button>)}</div></div>)}</div>
        </Step>
      )}

      {pv && !pv.mappingProblem && (
        <Step n={pv.duplicates.length ? 5 : 4} title="Tags, pipeline stage, assignment">
          <div className="grid md:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-[12px] text-[color:var(--hx-a1a1a6)]">Tags for every imported lead<input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="roofing-pilot, verified-phone" className="h-[38px] rounded-[8px] px-3 text-[13px]" style={input} /></label>
            <label className="flex flex-col gap-1 text-[12px] text-[color:var(--hx-a1a1a6)]">Pipeline stage<select value={stage} onChange={(e) => setStage(e.target.value)} className="h-[38px] rounded-[8px] px-2 text-[13px]" style={input}>{(meta?.stages ?? []).map((s) => <option key={s} value={s}>{STAGE_LABEL[s] ?? s}</option>)}</select></label>
            <div className="flex gap-2"><label className="flex flex-col gap-1 text-[12px] text-[color:var(--hx-a1a1a6)] w-[120px]">Extra tags on the last…<input value={rangeN} onChange={(e) => setRangeN(e.target.value.replace(/\D/g, ""))} placeholder="15" className="h-[38px] rounded-[8px] px-3 text-[13px]" style={input} /></label><label className="flex flex-col gap-1 text-[12px] text-[color:var(--hx-a1a1a6)] flex-1">…rows get these tags<input value={rangeTags} onChange={(e) => setRangeTags(e.target.value)} placeholder="priority-dossier" className="h-[38px] rounded-[8px] px-3 text-[13px]" style={input} /></label></div>
            <label className="flex flex-col gap-1 text-[12px] text-[color:var(--hx-a1a1a6)]">Assign by column<select value={assignCol} onChange={(e) => { setAssignCol(e.target.value); setAssignMap({}); }} className="h-[38px] rounded-[8px] px-2 text-[13px]" style={input}><option value="">Don&apos;t assign</option>{pv.groupValues.length > 0 && <option value="group">Grouping column ({pv.groupValues.length} values)</option>}</select></label>
          </div>
          {assignCol === "group" && assignValues.length > 0 && <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{assignValues.map((v) => <label key={v} className="flex flex-col gap-1 text-[12px] text-[color:var(--hx-a1a1a6)]"><span className="font-mono">{v}</span><select value={assignMap[v] ?? ""} onChange={(e) => setAssignMap((m) => ({ ...m, [v]: e.target.value }))} className="h-[36px] rounded-[8px] px-2 text-[13px]" style={input}><option value="">Unassigned</option>{(meta?.team ?? []).map((t) => <option key={t.id} value={t.id}>{t.full_name || t.email}</option>)}</select></label>)}</div>}
          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <button type="button" onClick={() => void commit()} disabled={!canImport} className="h-[42px] px-5 rounded-full text-[13.5px] font-semibold disabled:opacity-50" style={{ background: "rgb(var(--w))", color: "rgb(var(--k))" }}>{progress ? "Importing…" : `Import ${pv.validCount} row${pv.validCount === 1 ? "" : "s"}`}</button>
            {progress && <div className="flex-1 min-w-[200px]"><div className="h-[8px] rounded-full overflow-hidden" style={{ background: "rgb(var(--w) / 0.08)" }}><div className="h-full rounded-full transition-all" style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%`, background: "var(--hx-30d158)" }} /></div><div className="text-[11.5px] text-[color:var(--hx-6e6e73)] mt-1">{progress.done} / {progress.total} rows</div></div>}
          </div>
        </Step>
      )}

      {outcome && (
        <Step n={pv?.duplicates.length ? 6 : 5} title="Import report">
          <div className="flex items-center gap-2 text-[13px] text-[color:var(--hx-30d158)] mb-3"><CheckCircle2 size={15} />Done — import {outcome.importId.slice(0, 8)}</div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-center">{[["Rows", outcome.outcome.total], ["Imported", outcome.outcome.imported], ["Merged in file", outcome.outcome.merged_in_file], ["Merged into existing", outcome.outcome.merged_existing], ["Skipped", outcome.outcome.skipped], ["Errored", outcome.outcome.errored]].map(([l, n]) => <div key={String(l)} className="rounded-[10px] p-3" style={{ background: "var(--hx-050505)", border: "1px solid rgb(var(--w) / 0.08)" }}><div className="text-[22px] font-semibold text-[color:var(--hx-f5f5f7)]">{n}</div><div className="text-[11px] text-[color:var(--hx-6e6e73)]">{l}</div></div>)}</div>
          {outcome.outcome.unassigned > 0 && <div className="mt-2 text-[12.5px] text-[color:var(--hx-ffd60a)]">{outcome.outcome.unassigned} imported lead{outcome.outcome.unassigned === 1 ? "" : "s"} had a group value with no assignee and stayed unassigned.</div>}
          {outcome.outcome.lines.length > 0 && <div className="mt-3 max-h-[260px] overflow-y-auto rounded-[10px]" style={{ border: "1px solid rgb(var(--w) / 0.08)" }}><table className="w-full text-[12.5px]"><thead><tr className="text-left text-[color:var(--hx-6e6e73)]"><th className="px-3 py-2 font-medium">Row</th><th className="px-3 py-2 font-medium">Business</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Reason</th></tr></thead><tbody>{outcome.outcome.lines.map((l, i) => <tr key={i} style={{ borderTop: "1px solid rgb(var(--w) / 0.06)" }} className="text-[color:var(--hx-f5f5f7)]"><td className="px-3 py-2 text-[color:var(--hx-6e6e73)]">{l.row}</td><td className="px-3 py-2">{l.name}</td><td className="px-3 py-2">{l.status.replace(/_/g, " ")}</td><td className="px-3 py-2 text-[color:var(--hx-a1a1a6)]">{l.reason}</td></tr>)}</tbody></table></div>}
          <div className="mt-4 flex gap-3"><button type="button" onClick={downloadReport} className="inline-flex items-center gap-2 h-[36px] px-4 rounded-full text-[12.5px] font-semibold" style={{ border: "1px solid rgb(var(--w) / 0.14)", color: "var(--hx-f5f5f7)" }}><Download size={14} />Download report CSV</button><Link href="/team/leads" className="inline-flex items-center h-[36px] px-4 rounded-full text-[12.5px] font-semibold" style={{ background: "rgb(var(--w))", color: "rgb(var(--k))" }}>Open Leads</Link></div>
        </Step>
      )}
    </div>
  );
}
