"use client";

import { useState } from "react";
import Link from "next/link";
import type { LedgerRow } from "@/lib/customerPortal/agent";
import { TIERS, bookedCallsFor } from "@/lib/agentProgram/config";

type Cap = { key: string; name: string; short: string; enabled: boolean; spend: number };
type Props = { tierName: string | null; isSandbox: boolean; stockName: string | null; trialExpiresAt: string | null; trialExpired: boolean; balance: number; allotment: number; creditLevel: "ok" | "warn" | "critical" | "empty"; usedPct: number; agentStatus: "green" | "yellow" | "red"; workPausedReason: string | null; nextRefill: string | null; capabilities: Cap[]; ledger: LedgerRow[]; priceListVisible: boolean; overseer: { name: string; role: string } | null; capabilityLimit: number; weekStats: { done: number; pending: number; approved: number } };

const BAR: Record<string, string> = { ok: "#059669", warn: "#d97706", critical: "#dc2626", empty: "#dc2626" };
const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function AgentDashboard(p: Props) {
  const [caps, setCaps] = useState(p.capabilities);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const enabledCount = caps.filter((c) => c.enabled).length;

  const toggle = async (key: string, enabled: boolean) => {
    setBusy(key); setMsg(null);
    const r = await fetch("/api/dashboard/capabilities", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ capability: key, enabled }) });
    const j = await r.json(); setBusy(null);
    if (!r.ok) { setMsg(j.error); return; }
    setCaps((c) => c.map((x) => (x.key === key ? { ...x, enabled } : x)));
  };
  const badge = (r: LedgerRow) => r.type === "USAGE" && r.amount === 0 ? { t: "Failed · 0 credits", c: "text-neutral-500 bg-neutral-100" } : r.type === "USAGE" ? { t: "Done", c: "text-emerald-700 bg-emerald-50" } : r.type === "EXPIRATION" ? { t: "Expired", c: "text-neutral-500 bg-neutral-100" } : { t: "Credits added", c: "text-blue-700 bg-blue-50" };

  return (
    <div className="flex flex-col gap-6">
      {p.isSandbox && (
        <div className="rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 border border-amber-200 bg-amber-50">
          <div className="text-[12.5px] text-amber-900"><span className="font-semibold">DEMO — sample data.</span> Your agent is working on {p.stockName ?? "a sample business"}; nothing is sent to real customers.{p.trialExpiresAt && !p.trialExpired ? ` Trial ends ${new Date(p.trialExpiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.` : ""}</div>
          <Link href="/agent#pricing" className="shrink-0 text-[12.5px] font-semibold text-white bg-neutral-900 rounded-full px-4 py-2">Go live →</Link>
        </div>
      )}
      {(p.creditLevel === "empty" || p.trialExpired) && (
        <div className="rounded-xl p-4 border border-red-200 bg-red-50">
          <div className="text-[13.5px] font-semibold text-red-800">{p.trialExpired ? "Your trial has ended." : "Your agent is paused — out of credits."}</div>
          <div className="text-[12.5px] text-red-700 mt-1">Reports and everything already done stay available. {p.isSandbox ? "Choose Solo or Agency to run your agent on your real business." : "Add a top-up pack or wait for your monthly refill."}</div>
          <div className="mt-3 flex gap-2">{p.isSandbox ? <Link href="/agent#pricing" className="text-[12.5px] font-semibold text-white bg-neutral-900 rounded-full px-4 py-2">See Solo & Agency →</Link> : <Link href="/dashboard/credits" className="text-[12.5px] font-semibold text-white bg-neutral-900 rounded-full px-4 py-2">Top up credits →</Link>}</div>
        </div>
      )}

      {/* Top strip */}
      <div className="grid sm:grid-cols-4 gap-3">
        <div className="border border-neutral-200 rounded-xl p-4"><div className="text-[11px] uppercase tracking-wide text-neutral-400 mb-1">Agent status</div><div className="flex items-center gap-2 text-[14px] font-medium text-neutral-900"><span className="w-2.5 h-2.5 rounded-full" style={{ background: p.agentStatus === "green" ? "#059669" : p.agentStatus === "yellow" ? "#d97706" : "#dc2626" }} />{p.agentStatus === "green" ? "Working" : p.agentStatus === "yellow" ? "Running low" : "Paused"}</div><div className="text-[11.5px] text-neutral-400 mt-1">{p.tierName ?? "No plan"}{p.capabilityLimit < 8 ? ` · ${enabledCount}/${p.capabilityLimit} watching` : ` · ${enabledCount}/8 on`}</div></div>
        <div className="border border-neutral-200 rounded-xl p-4 sm:col-span-2"><div className="flex items-baseline justify-between"><div className="text-[11px] uppercase tracking-wide text-neutral-400">Credits</div><div className="text-[11.5px] text-neutral-400">{p.nextRefill ? `Refills ${new Date(p.nextRefill).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : p.isSandbox ? "One-time trial grant" : ""}</div></div><div className="mt-1 flex items-baseline gap-2"><span className="text-[24px] font-semibold text-neutral-900 leading-none">{p.balance}</span><span className="text-[12px] text-neutral-400">of {p.allotment}</span></div><div className="mt-2 h-2 rounded-full bg-neutral-100 overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, 100 - p.usedPct)}%`, background: BAR[p.creditLevel] }} /></div>{p.creditLevel !== "ok" && <div className="text-[11.5px] mt-1.5" style={{ color: BAR[p.creditLevel] }}>{p.creditLevel === "empty" ? "Out of credits — work paused" : `${p.usedPct}% used${p.creditLevel === "critical" ? " — nearly out" : " — consider a top-up"}`}</div>}</div>
        <div className="border border-neutral-200 rounded-xl p-4"><div className="text-[11px] uppercase tracking-wide text-neutral-400 mb-1">This week</div><div className="text-[13px] text-neutral-900">{p.weekStats.done} done · {p.weekStats.pending} pending</div><div className="text-[11.5px] text-neutral-400 mt-1">{p.weekStats.approved} human-approved</div><div className="mt-2 text-[11.5px] text-neutral-500 truncate">{p.overseer ? `Overseer: ${p.overseer.name}` : "Overseer assigned at onboarding"}</div></div>
      </div>

      {/* Capability cards */}
      <section>
        <div className="flex items-center justify-between mb-3"><h2 className="text-[13px] font-semibold text-neutral-900">Capabilities</h2><span className="text-[11.5px] text-neutral-400">Toggles are free · per-card spend this cycle</span></div>
        {msg && <div className="text-[12px] text-amber-700 mb-2">{msg}</div>}
        <div className="grid sm:grid-cols-2 gap-3">
          {caps.map((c) => (
            <div key={c.key} className={`border rounded-xl p-4 flex items-start justify-between gap-3 ${c.enabled ? "border-neutral-200" : "border-neutral-100 bg-neutral-50/60"}`}>
              <div className={c.enabled ? "" : "opacity-70"}><div className="text-[13.5px] font-medium text-neutral-900">{c.name}</div><div className="text-[12px] text-neutral-500 mt-0.5">{c.short}</div><div className="text-[11.5px] text-neutral-400 mt-2">{c.spend} credits this cycle</div></div>
              <button role="switch" aria-checked={c.enabled} disabled={busy === c.key} onClick={() => toggle(c.key, !c.enabled)} className="shrink-0 relative w-11 h-6 rounded-full transition-colors disabled:opacity-50" style={{ background: c.enabled ? "#059669" : "#d4d4d4" }} aria-label={`${c.enabled ? "Turn off" : "Turn on"} ${c.name}`}><span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: c.enabled ? 22 : 2 }} /></button>
            </div>
          ))}
        </div>
      </section>

      {/* Activity feed */}
      <section>
        <div className="flex items-center justify-between mb-3"><h2 className="text-[13px] font-semibold text-neutral-900">Activity</h2><Link href="/dashboard/credits" className="text-[11.5px] font-medium text-neutral-500 underline underline-offset-2">Full ledger →</Link></div>
        <div className="border border-neutral-200 rounded-xl divide-y divide-neutral-100">
          {p.ledger.length === 0 ? <div className="p-6 text-[12.5px] text-neutral-500">Nothing yet. {p.isSandbox ? "Your agent's first tasks on the sample business appear here with their credit receipts." : "Every action your agent completes appears here with its receipt."}</div> : p.ledger.slice(0, 12).map((r) => { const b = badge(r); return (
            <div key={r.id} className="px-4 py-3 flex items-center justify-between gap-3"><div className="min-w-0"><div className="text-[13px] text-neutral-900 truncate">{r.description || r.type.toLowerCase()}</div><div className="text-[11px] text-neutral-400">{fmt(r.created_at)}</div></div><div className="shrink-0 flex items-center gap-2"><span className="tabular-nums text-[12.5px] text-neutral-700">{r.amount > 0 ? "+" : ""}{r.amount} cr</span><span className={`text-[10.5px] font-medium rounded-full px-2 py-0.5 ${b.c}`}>{b.t}</span></div></div>); })}
        </div>
      </section>
      {!p.priceListVisible && <div className="text-[11.5px] text-neutral-400">Spend is shown per action. The full credit price list and top-up packs unlock on {TIERS[1].name} ({bookedCallsFor(TIERS[1].credits)} booked calls/month) and {TIERS[2].name}.</div>}
    </div>
  );
}
