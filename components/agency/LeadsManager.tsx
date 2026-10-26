"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMultiSelect, SelectCircle, SelectToggle, BulkBar, postJson, type BulkAction } from "@/components/ui/MultiSelect";
import { plural } from "@/lib/ui/selection";
import { centsToUsd, type Stage } from "@/lib/agency/stages";

export type LeadRow = { id: string; business_name: string; contact_name: string | null; email: string | null; phone: string | null; city: string | null; stage: string; value_cents: number; created_at: string };
const inputCls = "h-[38px] rounded-[8px] px-3 text-[13px] outline-none w-full";
const inputSt = { background: "var(--hx-111111)", border: "1px solid rgb(var(--w) / 0.1)", color: "var(--hx-f5f5f7)" };

export default function LeadsManager({ leads, stages, canAdd }: { leads: LeadRow[]; stages: Stage[]; canAdd: boolean }) {
  const router = useRouter(); const [q, setQ] = useState(""); const [stageF, setStageF] = useState(""); const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ business_name: "", contact_name: "", email: "", phone: "", city: "", source: "", value: "" }); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const label = (k: string) => stages.find((s) => s.key === k)?.label ?? k;
  const shown = useMemo(() => leads.filter((l) => (!stageF || l.stage === stageF) && (!q || `${l.business_name} ${l.contact_name ?? ""} ${l.email ?? ""} ${l.city ?? ""}`.toLowerCase().includes(q.toLowerCase()))), [leads, q, stageF]);
  const ms = useMultiSelect(shown.map((l) => l.id));
  const call = async (body: Record<string, unknown>) => { const j = await postJson("/api/app/leads", body); router.refresh(); return j; };
  const actions: BulkAction[] = [
    { label: "Move to next stage", tone: "primary", confirm: (n) => `Move ${plural(n, "lead")} to their next stage?`, run: async (ids) => { const j = await call({ action: "next", ids }); return `${plural(j.moved, "lead")} moved forward${j.blocked ? ` · ${j.blocked} not moved (${j.blockedReason})` : ""}`; } },
    { label: "Move to…", options: stages.map((s) => ({ label: s.label, value: s.key })), confirm: (n) => `Move ${plural(n, "lead")}?`, run: async (ids, v) => { const j = await call({ action: "stage", ids, stage: v }); return `${plural(j.moved, "lead")} moved${j.unchanged ? ` · ${j.unchanged} already there` : ""}`; } },
    { label: "Archive", tone: "danger", confirm: (n) => `Archive ${plural(n, "lead")}? They leave your lists; history is kept.`, run: async (ids) => { const j = await call({ action: "archive", ids }); return `${plural(j.archived, "lead")} archived`; } },
  ];
  async function add(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await call({ action: "create", ...f }); setF({ business_name: "", contact_name: "", email: "", phone: "", city: "", source: "", value: "" }); setAdding(false); } catch (x) { setErr(x instanceof Error ? x.message : "That didn't work."); } finally { setBusy(false); }
  }
  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input className={inputCls} style={{ ...inputSt, maxWidth: 260 }} placeholder="Search leads" aria-label="Search leads" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inputCls} style={{ ...inputSt, maxWidth: 200 }} aria-label="Filter by stage" value={stageF} onChange={(e) => setStageF(e.target.value)}><option value="">All stages</option>{stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
        <span className="ml-auto flex items-center gap-2"><SelectToggle ms={ms} total={shown.length} noun="leads" />{canAdd && <button type="button" onClick={() => setAdding((v) => !v)} className="h-[32px] px-4 rounded-full bg-white text-black text-[12.5px] font-semibold">{adding ? "Close" : "Add lead"}</button>}</span>
      </div>
      {adding && (
        <form onSubmit={add} className="rounded-[14px] p-5 mb-5 grid gap-3 md:grid-cols-4" style={{ background: "var(--hx-111111)", border: "1px solid rgb(var(--w) / 0.07)" }}>
          {([["business_name", "Business name *"], ["contact_name", "Contact name"], ["email", "Email"], ["phone", "Phone"], ["city", "City"], ["source", "Where it came from"], ["value", "Deal value ($)"]] as const).map(([k, ph]) => <input key={k} className={inputCls} style={inputSt} placeholder={ph} aria-label={ph} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />)}
          <button disabled={busy || f.business_name.trim().length < 2} className="h-[38px] rounded-[8px] bg-white text-black text-[12.5px] font-semibold disabled:opacity-40">{busy ? "Adding…" : "Save lead"}</button>
          {err && <div role="alert" className="md:col-span-4 text-[13px]" style={{ color: "var(--hx-ff453a)" }}>{err}</div>}
        </form>
      )}
      <div className="rounded-[14px] overflow-hidden" style={{ border: "1px solid rgb(var(--w) / 0.07)" }}>
        <table className="w-full text-[13px]"><thead><tr className="text-left text-[color:var(--hx-6e6e73)]" style={{ background: "var(--hx-0c0c0c)" }}>{ms.active && <th className="w-[44px]" />}<th className="px-4 py-2.5 font-medium">Lead</th><th className="px-4 py-2.5 font-medium hidden md:table-cell">Contact</th><th className="px-4 py-2.5 font-medium">Stage</th><th className="px-4 py-2.5 font-medium text-right">Value</th></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-[color:var(--hx-6e6e73)]">{leads.length ? "No leads match that filter." : "No leads yet. Add your first lead to start your pipeline."}</td></tr>}
            {shown.map((l) => (
              <tr key={l.id} style={{ borderTop: "1px solid rgb(var(--w) / 0.06)", background: ms.isSelected(l.id) ? "rgba(10,132,255,0.08)" : undefined }}>
                {ms.active && <td className="pl-3 w-[44px]"><SelectCircle checked={ms.isSelected(l.id)} onToggle={() => ms.toggle(l.id)} label={`Select ${l.business_name}`} /></td>}
                <td className="px-4 py-3"><Link href={`/app/leads/${l.id}`} className="font-medium hover:underline">{l.business_name}</Link>{l.city && <div className="text-[11.5px] text-[color:var(--hx-6e6e73)]">{l.city}</div>}</td>
                <td className="px-4 py-3 hidden md:table-cell text-[color:var(--hx-a1a1a6)]">{l.contact_name || "—"}<div className="text-[11.5px] text-[color:var(--hx-6e6e73)]">{l.email || l.phone || ""}</div></td>
                <td className="px-4 py-3"><span className="rounded-full px-2.5 py-1 text-[11.5px]" style={{ background: "var(--hx-151515)", border: "1px solid rgb(var(--w) / 0.08)" }}>{label(l.stage)}</span></td>
                <td className="px-4 py-3 text-right">{l.value_cents ? centsToUsd(l.value_cents) : "—"}</td>
              </tr>))}
          </tbody></table>
      </div>
      <BulkBar ms={ms} noun={(n) => plural(n, "lead")} actions={actions} />
      {ms.active && <div className="h-[96px]" />}
    </div>
  );
}
