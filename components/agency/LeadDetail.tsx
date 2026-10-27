"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { centsToUsd, type Stage } from "@/lib/agency/stages";

type Lead = { id: string; business_name: string; contact_name: string | null; email: string | null; phone: string | null; website: string | null; city: string | null; source: string | null; stage: string; value_cents: number; expected_close: string | null; demo_id: string | null };
type Act = { id: string; kind: string; body: string; created_at: string };
const inputCls = "h-[36px] rounded-[8px] px-3 text-[13px] outline-none w-full";
const st = { background: "var(--hx-111111)", border: "1px solid rgb(var(--w) / 0.1)", color: "var(--hx-f5f5f7)" };
const card = { background: "var(--hx-111111)", border: "1px solid rgb(var(--w) / 0.07)" };

export default function LeadDetail({ lead, stages, activities, followups, demos, attachedDemoUrl }: { lead: Lead; stages: Stage[]; activities: Act[]; followups: { id: string; title: string; due_at: string }[]; demos: { id: string; business_name: string; slug: string }[]; attachedDemoUrl: string | null }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState(""); const [fuTitle, setFuTitle] = useState(""); const [fuDue, setFuDue] = useState(""); const [demo, setDemo] = useState(""); const [value, setValue] = useState(String(lead.value_cents / 100 || "")); const [close, setClose] = useState(lead.expected_close ?? "");
  const label = (k: string) => stages.find((s) => s.key === k)?.label ?? k;
  async function call(body: Record<string, unknown>) {
    setBusy(true); setErr(null);
    try { const r = await fetch("/api/app/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lead_id: lead.id, ...body }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "That didn't work."); router.refresh(); return true; }
    catch (e) { setErr(e instanceof Error ? e.message : "That didn't work."); return false; } finally { setBusy(false); }
  }
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-end gap-4">
        <div className="mr-auto"><h1 className="text-[26px] font-semibold tracking-tight">{lead.business_name}</h1><div className="text-[13px] text-[color:var(--hx-a1a1a6)] mt-1">{[lead.contact_name, lead.email, lead.phone, lead.city].filter(Boolean).join(" · ") || "No contact details yet"}</div></div>
        <label className="text-[11.5px] text-[color:var(--hx-6e6e73)] flex flex-col gap-1">Stage<select disabled={busy} value={lead.stage} onChange={(e) => void call({ action: "stage", ids: [lead.id], stage: e.target.value })} className={inputCls} style={{ ...st, minWidth: 180 }}>{stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
      </div>
      {err && <div role="alert" className="mt-3 text-[13px]" style={{ color: "var(--hx-ff453a)" }}>{err}</div>}
      <div className="grid gap-4 mt-6 md:grid-cols-3">
        <div className="rounded-[14px] p-5 md:col-span-1" style={card}>
          <div className="text-[12px] uppercase tracking-wide text-[color:var(--hx-6e6e73)] mb-3">Deal</div>
          <label className="text-[12px] text-[color:var(--hx-a1a1a6)] flex flex-col gap-1 mb-3">Value ($)<input className={inputCls} style={st} value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" /></label>
          <label className="text-[12px] text-[color:var(--hx-a1a1a6)] flex flex-col gap-1 mb-3">Expected close<input type="date" className={inputCls} style={st} value={close} onChange={(e) => setClose(e.target.value)} /></label>
          <button disabled={busy} onClick={() => void call({ action: "update", value: Number(value) || 0, expected_close: close })} className="h-[34px] px-4 rounded-[8px] bg-white text-black text-[12.5px] font-semibold disabled:opacity-40">Save deal</button>
          <div className="text-[12px] text-[color:var(--hx-6e6e73)] mt-3">{lead.value_cents ? `${centsToUsd(lead.value_cents)} in ${label(lead.stage)}` : "No value set"}</div>
          <div className="text-[12px] uppercase tracking-wide text-[color:var(--hx-6e6e73)] mt-6 mb-3">Demo</div>
          {attachedDemoUrl ? <a href={attachedDemoUrl} target="_blank" rel="noopener noreferrer" className="text-[13px] underline">Open attached demo</a> : <div className="text-[12.5px] text-[color:var(--hx-6e6e73)]">No demo attached.</div>}
          <select value={demo} onChange={(e) => setDemo(e.target.value)} className={`${inputCls} mt-3`} style={st}><option value="">{demos.length ? "Attach a published demo…" : "No published demos yet"}</option>{demos.map((d) => <option key={d.id} value={d.id}>{d.business_name}</option>)}</select>
          <button disabled={busy || !demo} onClick={() => void call({ action: "attach_demo", demo_id: demo })} className="h-[34px] px-4 mt-2 rounded-[8px] text-[12.5px] font-semibold disabled:opacity-40" style={{ border: "1px solid rgb(var(--w) / 0.14)" }}>Attach demo</button>
          <div className="text-[11.5px] text-[color:var(--hx-6e6e73)] mt-2">When the prospect opens the demo link, this lead moves to Demo Viewed automatically.</div>
        </div>
        <div className="md:col-span-2 flex flex-col gap-4">
          <div className="rounded-[14px] p-5" style={card}>
            <div className="text-[12px] uppercase tracking-wide text-[color:var(--hx-6e6e73)] mb-3">Add to the record</div>
            <textarea className="w-full rounded-[8px] p-3 text-[13px] outline-none min-h-[70px]" style={st} placeholder="Write a note about a call, a reply, anything worth remembering" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex gap-2 mt-2"><button disabled={busy || !note.trim()} onClick={async () => { if (await call({ action: "note", body: note })) setNote(""); }} className="h-[34px] px-4 rounded-[8px] bg-white text-black text-[12.5px] font-semibold disabled:opacity-40">Save note</button><button disabled={busy || !note.trim()} onClick={async () => { if (await call({ action: "note", kind: "call", body: note })) setNote(""); }} className="h-[34px] px-4 rounded-[8px] text-[12.5px] font-semibold disabled:opacity-40" style={{ border: "1px solid rgb(var(--w) / 0.14)" }}>Log as call</button></div>
            <div className="grid gap-2 md:grid-cols-[1fr_200px_auto] mt-4"><input className={inputCls} style={st} placeholder="Follow-up (for example: send pricing)" value={fuTitle} onChange={(e) => setFuTitle(e.target.value)} /><input type="datetime-local" className={inputCls} style={st} value={fuDue} onChange={(e) => setFuDue(e.target.value)} /><button disabled={busy || !fuTitle.trim() || !fuDue} onClick={async () => { if (await call({ action: "followup", title: fuTitle, due_at: new Date(fuDue).toISOString() })) { setFuTitle(""); setFuDue(""); } }} className="h-[36px] px-4 rounded-[8px] text-[12.5px] font-semibold disabled:opacity-40" style={{ border: "1px solid rgb(var(--w) / 0.14)" }}>Add follow-up</button></div>
            {followups.length > 0 && <ul className="mt-3 text-[12.5px] text-[color:var(--hx-a1a1a6)]">{followups.map((f) => <li key={f.id}>• {f.title} · {new Date(f.due_at).toLocaleString()}</li>)}</ul>}
          </div>
          <div className="rounded-[14px] p-5" style={card}>
            <div className="text-[12px] uppercase tracking-wide text-[color:var(--hx-6e6e73)] mb-3">History</div>
            {activities.length === 0 && <div className="text-[13px] text-[color:var(--hx-6e6e73)]">Nothing yet.</div>}
            <ol className="flex flex-col gap-3">{activities.map((a) => <li key={a.id} className="text-[13px]"><span className="text-[11px] uppercase tracking-wide text-[color:var(--hx-6e6e73)]">{a.kind.replace("_", " ")} · {new Date(a.created_at).toLocaleString()}</span><div className="mt-0.5 whitespace-pre-wrap">{a.body}</div></li>)}</ol>
          </div>
        </div>
      </div>
    </div>
  );
}
