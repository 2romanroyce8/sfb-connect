"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS_LABEL, FORWARD, canMove, margin, usd, type OrderStatus } from "@/lib/agency/orders";

type Order = { id: string; title: string; status: string; cost_setup_cents: number; cost_monthly_cents: number; price_setup_cents: number; price_monthly_cents: number; notes: string };
const inp = "h-[36px] rounded-[8px] px-3 text-[13px] outline-none w-full"; const st = { background: "var(--hx-111111)", border: "1px solid rgb(var(--w) / 0.1)", color: "var(--hx-f5f5f7)" }; const card = { background: "var(--hx-111111)", border: "1px solid rgb(var(--w) / 0.07)" };
const dollars = (c: number) => (c ? String(c / 100) : "");
export default function OrderDetail({ order, clientName, onboardingApproved, service, tasks, events }: { order: Order; clientName: string; onboardingApproved: boolean; service: { name: string; description: string } | null; tasks: { id: string; title: string; done_at: string | null }[]; events: { id: string; kind: string; body: string; created_at: string }[] }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [cs, setCs] = useState(dollars(order.cost_setup_cents)), [cm, setCm] = useState(dollars(order.cost_monthly_cents)), [ps, setPs] = useState(dollars(order.price_setup_cents)), [pm, setPm] = useState(dollars(order.price_monthly_cents)); const [notes, setNotes] = useState(order.notes);
  const [note, setNote] = useState(""); const [task, setTask] = useState("");
  async function call(body: Record<string, unknown>) {
    setBusy(true); setErr(null);
    try { const r = await fetch("/api/app/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ order_id: order.id, ...body }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "That didn't work."); router.refresh(); return true; }
    catch (e) { setErr(e instanceof Error ? e.message : "That didn't work."); return false; } finally { setBusy(false); }
  }
  const n = (v: string) => Number(v.replace(/[$,\s]/g, "")) || 0;
  const live = margin({ cost_setup_cents: Math.round(n(cs) * 100), cost_monthly_cents: Math.round(n(cm) * 100), price_setup_cents: Math.round(n(ps) * 100), price_monthly_cents: Math.round(n(pm) * 100) });
  const i = FORWARD.indexOf(order.status as OrderStatus); const next = i >= 0 ? FORWARD[i + 1] : undefined; const prev = i > 0 ? FORWARD[i - 1] : undefined; const closed = order.status === "canceled"; const doneN = tasks.filter((t) => t.done_at).length;
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-end gap-4"><div className="mr-auto"><h1 className="text-[26px] font-semibold tracking-tight">{order.title}</h1><div className="text-[13px] text-[color:var(--hx-a1a1a6)] mt-1">{clientName}{service ? ` · ${service.name}` : ""}</div></div><span className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold" style={{ background: "var(--hx-151515)", border: "1px solid rgb(var(--w) / 0.1)" }}>{STATUS_LABEL[order.status as OrderStatus] ?? order.status}</span></div>
      {err && <div role="alert" className="mt-3 text-[13px]" style={{ color: "var(--hx-ff453a)" }}>{err}</div>}
      <div className="mt-5 rounded-[14px] p-4 flex flex-wrap items-center gap-3" style={card}>
        <div className="flex flex-wrap gap-1.5 mr-auto">{FORWARD.map((s, k) => <span key={s} className="text-[11.5px] px-2.5 py-1 rounded-full" style={{ background: k === i ? "var(--hx-ffffff)" : "transparent", color: k === i ? "var(--hx-000000)" : k < i ? "var(--hx-a1a1a6)" : "var(--hx-6e6e73)", border: "1px solid rgb(var(--w) / 0.1)" }}>{STATUS_LABEL[s]}</span>)}</div>
        {!closed && <div className="flex gap-2">{prev && <button disabled={busy || !canMove(order.status, prev).ok} onClick={() => void call({ action: "status", to: prev })} className="h-[34px] px-3 rounded-[8px] text-[12.5px] font-semibold disabled:opacity-40" style={{ border: "1px solid rgb(var(--w) / 0.14)" }}>Back to {STATUS_LABEL[prev]}</button>}{next && <button disabled={busy} onClick={() => void call({ action: "status", to: next })} className="h-[34px] px-4 rounded-[8px] bg-white text-black text-[12.5px] font-semibold disabled:opacity-40">Move to {STATUS_LABEL[next]}</button>}<button disabled={busy} onClick={() => { if (window.confirm("Cancel this order? A canceled order can't be reopened.")) void call({ action: "status", to: "canceled" }); }} className="h-[34px] px-3 rounded-[8px] text-[12.5px] font-semibold disabled:opacity-40" style={{ color: "var(--hx-ff453a)", border: "1px solid rgb(var(--w) / 0.14)" }}>Cancel order</button></div>}
      </div>
      {!onboardingApproved && !closed && <div className="mt-3 text-[12.5px] text-[color:var(--hx-a1a1a6)]">The client&apos;s onboarding isn&apos;t approved yet, so this order can&apos;t move into development. Review it in the Clients tab.</div>}
      <div className="grid gap-4 mt-5 md:grid-cols-5">
        <div className="md:col-span-2 rounded-[14px] p-5" style={card}>
          <div className="text-[12px] uppercase tracking-wide text-[color:var(--hx-6e6e73)] mb-3">Pricing and margin</div>
          <div className="grid grid-cols-2 gap-3 text-[12px] text-[color:var(--hx-a1a1a6)]">
            <label className="flex flex-col gap-1">Your cost, setup ($)<input className={inp} style={st} inputMode="decimal" value={cs} onChange={(e) => setCs(e.target.value)} /></label><label className="flex flex-col gap-1">Your cost, monthly ($)<input className={inp} style={st} inputMode="decimal" value={cm} onChange={(e) => setCm(e.target.value)} /></label>
            <label className="flex flex-col gap-1">Client pays, setup ($)<input className={inp} style={st} inputMode="decimal" value={ps} onChange={(e) => setPs(e.target.value)} /></label><label className="flex flex-col gap-1">Client pays, monthly ($)<input className={inp} style={st} inputMode="decimal" value={pm} onChange={(e) => setPm(e.target.value)} /></label></div>
          <textarea className="w-full mt-3 rounded-[8px] p-2.5 text-[12.5px] outline-none min-h-[60px]" style={st} placeholder="Scope notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button disabled={busy || ["live", "maintenance", "canceled"].includes(order.status)} onClick={() => void call({ action: "quote", cost_setup: cs || "0", cost_monthly: cm || "0", price_setup: ps || "0", price_monthly: pm || "0", notes })} className="mt-3 h-[34px] px-4 rounded-[8px] bg-white text-black text-[12.5px] font-semibold disabled:opacity-40">Save pricing</button>
          <div className="mt-4 pt-3 text-[12.5px] flex flex-col gap-1" style={{ borderTop: "1px solid rgb(var(--w) / 0.07)" }}><div>Setup profit: <strong>{usd(live.setup.profit)}</strong>{live.setup.pct !== null ? ` (${Math.round(live.setup.pct)}%)` : ""}</div><div>Monthly profit: <strong>{usd(live.monthly.profit)}</strong>{live.monthly.pct !== null ? ` (${Math.round(live.monthly.pct)}%)` : ""}</div><div>Recurring profit per year: <strong>{usd(live.yearlyRecurringProfit)}</strong></div><div className="text-[11.5px] text-[color:var(--hx-6e6e73)] mt-1">Computed from the numbers you entered. Your costs are never shown to the client.</div></div>
        </div>
        <div className="md:col-span-3 flex flex-col gap-4">
          <div className="rounded-[14px] p-5" style={card}><div className="flex items-center mb-3"><div className="text-[12px] uppercase tracking-wide text-[color:var(--hx-6e6e73)] mr-auto">Tasks</div><div className="text-[12px] text-[color:var(--hx-6e6e73)]">{doneN} of {tasks.length} done</div></div>
            <ul className="flex flex-col gap-2">{tasks.map((t) => <li key={t.id} className="flex items-center gap-2.5 text-[13px]"><input type="checkbox" aria-label={t.title} disabled={busy || closed} checked={!!t.done_at} onChange={(e) => void call({ action: "task_toggle", task_id: t.id, done: e.target.checked })} /><span style={t.done_at ? { textDecoration: "line-through", color: "var(--hx-6e6e73)" } : undefined}>{t.title}</span></li>)}</ul>
            {!closed && <div className="flex gap-2 mt-3"><input className={inp} style={st} placeholder="Add a task" value={task} onChange={(e) => setTask(e.target.value)} /><button disabled={busy || !task.trim()} onClick={async () => { if (await call({ action: "task_add", title: task })) setTask(""); }} className="h-[36px] px-4 rounded-[8px] text-[12.5px] font-semibold disabled:opacity-40" style={{ border: "1px solid rgb(var(--w) / 0.14)" }}>Add</button></div>}</div>
          <div className="rounded-[14px] p-5" style={card}><div className="text-[12px] uppercase tracking-wide text-[color:var(--hx-6e6e73)] mb-3">History</div>
            <div className="flex gap-2 mb-4"><input className={inp} style={st} placeholder="Add a note" value={note} onChange={(e) => setNote(e.target.value)} /><button disabled={busy || !note.trim()} onClick={async () => { if (await call({ action: "note", body: note })) setNote(""); }} className="h-[36px] px-4 rounded-[8px] text-[12.5px] font-semibold disabled:opacity-40" style={{ border: "1px solid rgb(var(--w) / 0.14)" }}>Save</button></div>
            <ol className="flex flex-col gap-3">{events.map((e) => <li key={e.id} className="text-[13px]"><span className="text-[11px] uppercase tracking-wide text-[color:var(--hx-6e6e73)]">{e.kind} · {new Date(e.created_at).toLocaleString()}</span><div className="mt-0.5 whitespace-pre-wrap">{e.body}</div></li>)}</ol></div>
        </div>
      </div>
    </div>
  );
}
