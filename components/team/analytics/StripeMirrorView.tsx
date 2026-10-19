"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { AnalyticsRange } from "@/lib/team/analytics/types";
import type { StripeMirror } from "@/lib/team/analytics/stripeMirror";
import { RangeBar, Kpi, CacheStamp, card, money } from "./shared";

type Resp = StripeMirror & { cache: { fetchedAt: string; fromCache: boolean; ageMs: number; ttlMs: number; error: string | null } };

export default function StripeMirrorView({ configured }: { configured: boolean }) {
  const [range, setRange] = useState<AnalyticsRange>("30d"); const [d, setD] = useState<Resp | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async (refresh = false) => { if (!configured) return; setBusy(true); setErr(null); try { const r = await fetch(`/api/team/analytics/stripe?range=${range}${refresh ? "&refresh=1" : ""}`, { cache: "no-store" }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "Failed."); setD(j); } catch (e) { setErr(e instanceof Error ? e.message : "Failed."); } finally { setBusy(false); } }, [range, configured]);
  useEffect(() => { void load(); }, [load]);
  if (!configured) return <div className="rounded-[12px] p-5 text-[13px] text-[color:var(--hx-a1a1a6)]" style={card}>Stripe isn&apos;t configured on this deployment, so there is nothing to mirror.</div>;
  return (
    <div className="flex flex-col gap-5">
      <RangeBar range={range} onChange={setRange} right={<CacheStamp cache={d?.cache ?? null} onRefresh={() => void load(true)} busy={busy} />} />
      <div className="text-[11.5px] text-[color:var(--hx-6e6e73)]">Read-only. Numbers are pulled from Stripe&apos;s API and shown as-is; nothing here can charge, refund or change a customer. {d && !d.livemode && <span className="text-[color:var(--hx-ffd60a)]">Test-mode key.</span>}{d?.truncated && <span className="text-[color:var(--hx-ffd60a)]"> Period has more than 2,000 objects in one list — totals are capped; narrow the range.</span>}</div>
      {err && <div className="text-[12.5px] text-[color:var(--hx-ff9f9a)]">{err}</div>}
      {!d ? <div className="text-[12.5px] text-[color:var(--hx-6e6e73)]">{busy ? "Pulling from Stripe…" : "Loading…"}</div> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Gross volume" value={money(d.grossVolume, 2)} sub={`${d.succeededCount} successful payment${d.succeededCount === 1 ? "" : "s"} · net of refunds ${money(d.netVolume, 2)}`} />
            <Kpi label="Failed payments" value={String(d.failedCount)} sub={d.failedCount ? `${money(d.failedAmount, 2)} attempted` : "none in range"} tone={d.failedCount ? "warn" : undefined} />
            <Kpi label="Refunds" value={money(d.refundsAmount, 2)} sub={`${d.refundsCount} refund${d.refundsCount === 1 ? "" : "s"}`} tone={d.refundsAmount ? "warn" : undefined} />
            <Kpi label="Disputes" value={String(d.disputesCount)} sub={d.disputesCount ? `${money(d.disputesAmount, 2)} · ${d.disputesOpen} needing a response` : "none in range"} tone={d.disputesOpen ? "bad" : undefined} />
            <Kpi label="New customers" value={String(d.newCustomers)} sub="Stripe customer objects created in range" />
            <Kpi label="Active subscriptions" value={String(d.activeSubscriptions)} sub={`${money(d.subscriptionMrr, 2)} MRR from Stripe prices${d.pastDueSubscriptions ? ` · ${d.pastDueSubscriptions} past due` : ""}`} tone={d.pastDueSubscriptions ? "warn" : undefined} />
            <Kpi label="Payouts" value={money(d.payoutsPaid, 2)} sub={`${d.payoutsPaidCount} paid in range${d.payoutsInTransit ? ` · ${money(d.payoutsInTransit, 2)} in transit` : ""}`} />
            <Kpi label="Balance" value={money(d.balanceAvailable, 2)} sub={`available · ${money(d.balancePending, 2)} pending`} tone="good" />
          </div>
          <div className="rounded-[12px] p-4" style={card}>
            <div className="flex items-center justify-between mb-2"><div className="text-[12px] font-semibold text-[color:var(--hx-f5f5f7)]">Gross volume by {d.granularity}</div><div className="text-[11px] text-[color:var(--hx-6e6e73)]">{d.currency} · {new Date(d.rangeStart).toLocaleDateString()} – {new Date(d.rangeEnd).toLocaleDateString()}</div></div>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.timeline} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgb(var(--w) / 0.05)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "var(--hx-6e6e73)", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis tick={{ fill: "var(--hx-6e6e73)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => money(Number(v))} width={64} />
                  <Tooltip contentStyle={{ background: "var(--hx-121212)", border: "1px solid rgb(var(--w) / 0.1)", borderRadius: 8, fontSize: 12 }} formatter={(v, n) => [money(Number(v), 2), n === "gross" ? "Gross" : "Refunds"]} />
                  <Bar dataKey="gross" fill="#635BFF" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="refunds" fill="#FF453A" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
