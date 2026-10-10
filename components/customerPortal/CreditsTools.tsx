"use client";

import { useState } from "react";
import type { LedgerRow } from "@/lib/customerPortal/agent";
import { CAPABILITIES, CREDITS_PAY_FOR_WORK } from "@/lib/agentProgram/config";

type Pack = { id: string; name: string; credits: number; usd: number };
const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function CreditsTools({ balance, isSandbox, priceListVisible, packs, ledger, creditsPerCall }: { balance: number; isSandbox: boolean; priceListVisible: boolean; packs: Pack[]; ledger: LedgerRow[]; creditsPerCall: number }) {
  const [calls, setCalls] = useState(10);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const rows = ledger.filter((r) => filter === "all" ? true : filter === "grants" ? r.amount > 0 : filter === "failed" ? (r.type === "USAGE" && r.amount === 0) : r.capability_key === filter);
  const buy = async (id: string) => {
    setBusy(id); setMsg(null);
    const r = await fetch("/api/dashboard/billing/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "credits", creditPackageId: id }) });
    const j = await r.json(); setBusy(null);
    if (!r.ok || !j.checkoutUrl) { setMsg(j.message || j.error || "Could not start checkout."); return; }
    window.location.href = j.checkoutUrl;
  };
  const need = calls * creditsPerCall;
  return (
    <div className="flex flex-col gap-8">
      {!isSandbox && <section className="border border-neutral-200 rounded-xl p-5">
        <h2 className="text-[13px] font-semibold text-neutral-900 mb-1">Planning calculator</h2>
        <p className="text-[12.5px] text-neutral-500 mb-3">One fully-worked prospect ≈ {creditsPerCall} credits (sourced, enriched, messaged, replied, booked).</p>
        <div className="flex flex-wrap items-center gap-3"><label className="text-[12.5px] text-neutral-700">Booked calls I want</label><input type="number" min={1} max={500} value={calls} onChange={(e) => setCalls(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} className="w-24 h-9 border border-neutral-300 rounded-lg px-2 text-[13px]" /><div className="text-[13px] text-neutral-900">≈ <span className="font-semibold">{need}</span> credits · you have {balance}{need > balance ? <span className="text-amber-700"> · {need - balance} short</span> : <span className="text-emerald-700"> · covered</span>}</div></div>
      </section>}
      {priceListVisible && !isSandbox && (
        <section><h2 className="text-[13px] font-semibold text-neutral-900 mb-1">Top-up packs <span className="font-normal text-neutral-400">· never expire while your membership is active</span></h2><p className="text-[12px] text-neutral-500 mb-3">{CREDITS_PAY_FOR_WORK}</p>{msg && <div className="text-[12px] text-amber-700 mb-2">{msg}</div>}<div className="grid sm:grid-cols-3 gap-3">{packs.map((p) => <div key={p.id} className="border border-neutral-200 rounded-xl p-4 flex flex-col"><div className="text-[15px] font-semibold text-neutral-900">{p.name}</div><div className="text-[20px] font-semibold text-neutral-900 mt-1">${p.usd.toLocaleString("en-US")}</div><button onClick={() => buy(p.id)} disabled={busy === p.id} className="mt-3 text-[12.5px] font-semibold text-white bg-neutral-900 rounded-full px-4 py-2 disabled:opacity-50">{busy === p.id ? "Opening…" : "Buy"}</button></div>)}</div></section>
      )}
      <section>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap"><h2 className="text-[13px] font-semibold text-neutral-900">Ledger</h2><div className="flex items-center gap-3"><select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8 border border-neutral-300 rounded-lg px-2 text-[12px] bg-white" aria-label="Filter ledger"><option value="all">All entries</option><option value="grants">Grants & top-ups</option><option value="failed">Didn&apos;t go through (0)</option>{CAPABILITIES.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select><a href="/api/dashboard/credits/export" className="text-[11.5px] font-medium text-neutral-500 underline underline-offset-2">Export CSV</a></div></div>
        <div className="border border-neutral-200 rounded-xl overflow-x-auto"><table className="w-full text-[12.5px]"><thead><tr className="text-left text-neutral-400 bg-neutral-50"><th className="px-4 py-2 font-medium">When</th><th className="px-4 py-2 font-medium">Action</th><th className="px-4 py-2 font-medium text-right">Credits</th><th className="px-4 py-2 font-medium text-right">Balance</th></tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={4} className="px-4 py-6 text-neutral-500">No ledger entries{filter !== "all" ? " for this filter" : " yet"}.</td></tr> : rows.map((r) => <tr key={r.id} className="border-t border-neutral-100"><td className="px-4 py-2 text-neutral-500 whitespace-nowrap">{fmt(r.created_at)}</td><td className="px-4 py-2 text-neutral-900">{r.description || r.type.toLowerCase()}{r.type === "USAGE" && r.amount === 0 ? <span className="ml-2 text-[10.5px] text-neutral-400">didn&apos;t go through · 0 credits</span> : null}</td><td className="px-4 py-2 text-right tabular-nums">{r.amount > 0 ? "+" : ""}{r.amount}</td><td className="px-4 py-2 text-right tabular-nums text-neutral-500">{r.balance_after}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}
