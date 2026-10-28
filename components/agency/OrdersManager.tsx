"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { STATUSES, STATUS_LABEL, margin, usd, type OrderStatus } from "@/lib/agency/orders";

type Row = { id: string; title: string; status: string; client: string; service: string | null; price_setup_cents: number; price_monthly_cents: number; cost_setup_cents: number; cost_monthly_cents: number };
const inp = "h-[36px] rounded-[8px] px-3 text-[13px] outline-none w-full"; const st = { background: "var(--hx-111111)", border: "1px solid rgb(var(--w) / 0.1)", color: "var(--hx-f5f5f7)" };
export default function OrdersManager({ rows, clients, services }: { rows: Row[]; clients: { id: string; name: string }[]; services: { id: string; name: string }[] }) {
  const router = useRouter(); const [client, setClient] = useState(""); const [service, setService] = useState(""); const [title, setTitle] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [f, setF] = useState("");
  const shown = useMemo(() => rows.filter((r) => !f || r.status === f), [rows, f]);
  const totals = useMemo(() => { const live = rows.filter((r) => ["live", "maintenance"].includes(r.status)); return { mrr: live.reduce((a, r) => a + r.price_monthly_cents, 0), cost: live.reduce((a, r) => a + r.cost_monthly_cents, 0), n: live.length }; }, [rows]);
  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try { const r = await fetch("/api/app/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create", client_id: client, service_id: service, title }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "That didn't work."); router.push(`/app/orders/${j.id}`); }
    catch (x) { setErr(x instanceof Error ? x.message : "That didn't work."); setBusy(false); }
  }
  return (
    <div className="mt-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[["Open orders", String(rows.filter((r) => !["live", "maintenance", "canceled"].includes(r.status)).length)], ["Live or maintenance", String(totals.n)], ["Monthly revenue (live)", usd(totals.mrr)], ["Monthly profit (live)", usd(totals.mrr - totals.cost)]].map(([k, v]) => <div key={k} className="rounded-[14px] p-4" style={{ background: "var(--hx-111111)", border: "1px solid rgb(var(--w) / 0.07)" }}><div className="text-[11.5px] uppercase tracking-wide text-[color:var(--hx-6e6e73)]">{k}</div><div className="text-[24px] font-semibold mt-1">{v}</div></div>)}
      </div>
      <form onSubmit={create} className="rounded-[14px] p-5 grid gap-3 md:grid-cols-4 mb-5" style={{ background: "var(--hx-111111)", border: "1px solid rgb(var(--w) / 0.07)" }}>
        <select className={inp} style={st} aria-label="Client" value={client} onChange={(e) => setClient(e.target.value)}><option value="">{clients.length ? "Choose a client…" : "Add a client first (Clients tab)"}</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className={inp} style={st} aria-label="Service" value={service} onChange={(e) => { setService(e.target.value); const sv = services.find((x) => x.id === e.target.value); if (sv && !title) setTitle(sv.name); }}><option value="">Service (optional)</option>{services.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <input className={inp} style={st} placeholder="Order name" aria-label="Order name" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button disabled={busy || !client || title.trim().length < 2} className="h-[36px] rounded-[8px] bg-white text-black text-[12.5px] font-semibold disabled:opacity-40">{busy ? "Creating…" : "New order"}</button>
        {err && <div role="alert" className="md:col-span-4 text-[13px]" style={{ color: "var(--hx-ff453a)" }}>{err}</div>}
      </form>
      <div className="flex flex-wrap gap-2 mb-3"><button onClick={() => setF("")} className="h-[30px] px-3 rounded-full text-[12px]" style={{ border: "1px solid rgb(var(--w) / 0.14)", background: f === "" ? "var(--hx-151515)" : "transparent" }}>All ({rows.length})</button>{STATUSES.map((s) => { const n = rows.filter((r) => r.status === s).length; return n ? <button key={s} onClick={() => setF(s)} className="h-[30px] px-3 rounded-full text-[12px]" style={{ border: "1px solid rgb(var(--w) / 0.14)", background: f === s ? "var(--hx-151515)" : "transparent" }}>{STATUS_LABEL[s]} ({n})</button> : null; })}</div>
      <div className="rounded-[14px] overflow-hidden" style={{ border: "1px solid rgb(var(--w) / 0.07)" }}>
        <table className="w-full text-[13px]"><thead><tr className="text-left text-[color:var(--hx-6e6e73)]" style={{ background: "var(--hx-0c0c0c)" }}><th className="px-4 py-2.5 font-medium">Order</th><th className="px-4 py-2.5 font-medium hidden md:table-cell">Client</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium text-right hidden md:table-cell">Monthly margin</th></tr></thead><tbody>
          {shown.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-[color:var(--hx-6e6e73)]">{rows.length ? "No orders in that status." : "No orders yet. Create the first one above."}</td></tr>}
          {shown.map((o) => { const m = margin(o); return <tr key={o.id} style={{ borderTop: "1px solid rgb(var(--w) / 0.06)" }}><td className="px-4 py-3"><Link href={`/app/orders/${o.id}`} className="font-medium hover:underline">{o.title}</Link>{o.service && <div className="text-[11.5px] text-[color:var(--hx-6e6e73)]">{o.service}</div>}</td><td className="px-4 py-3 hidden md:table-cell text-[color:var(--hx-a1a1a6)]">{o.client}</td><td className="px-4 py-3"><span className="rounded-full px-2.5 py-1 text-[11.5px]" style={{ background: "var(--hx-151515)", border: "1px solid rgb(var(--w) / 0.08)" }}>{STATUS_LABEL[o.status as OrderStatus] ?? o.status}</span></td><td className="px-4 py-3 text-right hidden md:table-cell">{o.price_monthly_cents ? `${usd(m.monthly.profit)}${m.monthly.pct !== null ? ` · ${Math.round(m.monthly.pct)}%` : ""}` : "—"}</td></tr>; })}
        </tbody></table></div>
    </div>
  );
}
