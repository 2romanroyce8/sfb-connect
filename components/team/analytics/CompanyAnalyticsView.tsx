"use client";

import { useCallback, useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { AnalyticsRange } from "@/lib/team/analytics/types";
import type { CompanyAnalytics } from "@/lib/team/analytics/company";
import { RangeBar, Kpi, CacheStamp, card, money } from "./shared";

type Resp = CompanyAnalytics & { cache: { fetchedAt: string; fromCache: boolean; ageMs: number; ttlMs: number; error: string | null } };

export default function CompanyAnalyticsView() {
  const [range, setRange] = useState<AnalyticsRange>("30d"); const [d, setD] = useState<Resp | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async (refresh = false) => { setBusy(true); setErr(null); try { const r = await fetch(`/api/team/analytics/company?range=${range}${refresh ? "&refresh=1" : ""}`, { cache: "no-store" }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "Failed."); setD(j); } catch (e) { setErr(e instanceof Error ? e.message : "Failed."); } finally { setBusy(false); } }, [range]);
  useEffect(() => { void load(); }, [load]);
  const delta = d?.collected.previousTotal != null && d.collected.previousTotal > 0 ? ((d.collected.total - d.collected.previousTotal) / d.collected.previousTotal) * 100 : null;
  return (
    <div className="flex flex-col gap-5">
      <RangeBar range={range} onChange={setRange} right={<CacheStamp cache={d?.cache ?? null} onRefresh={() => void load(true)} busy={busy} />} />
      {err && <div className="text-[12.5px] text-[color:var(--hx-ff9f9a)]">{err}</div>}
      {!d ? <div className="text-[12.5px] text-[color:var(--hx-6e6e73)]">Loading…</div> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Collected" value={money(d.collected.total)} sub={`${d.collected.count} payment${d.collected.count === 1 ? "" : "s"}${delta != null ? ` · ${delta >= 0 ? "+" : ""}${delta.toFixed(0)}% vs previous` : d.collected.previousTotal === 0 ? " · nothing in the previous period" : ""}`} tone={delta == null ? undefined : delta >= 0 ? "good" : "bad"} />
            <Kpi label="MRR" value={money(d.mrr.total)} sub={`${d.clients.active} active plan${d.clients.active === 1 ? "" : "s"}`} />
            <Kpi label="Active clients" value={String(d.clients.active)} sub={`${d.clients.newInRange} new in range`} />
            <Kpi label="Open pipeline" value={String(d.pipelineOpen.count)} sub={d.pipelineOpen.estValue ? `≈ ${money(d.pipelineOpen.estValue)}/mo if all close` : "no offer values set yet"} />
          </div>

          <div className="rounded-[12px] p-4" style={card}>
            <div className="flex items-center justify-between mb-2"><div className="text-[12px] font-semibold text-[color:var(--hx-f5f5f7)]">Collected over time</div><div className="text-[11px] text-[color:var(--hx-6e6e73)]">plan orders {money(d.collected.planOrders)} · add-ons & credits {money(d.collected.addons)} · manual {money(d.collected.manualPayments)}</div></div>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={d.timeline} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs><linearGradient id="col" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#30D158" stopOpacity={0.35} /><stop offset="100%" stopColor="#30D158" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid stroke="rgb(var(--w) / 0.05)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "var(--hx-6e6e73)", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis tick={{ fill: "var(--hx-6e6e73)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => money(Number(v))} width={64} />
                  <Tooltip contentStyle={{ background: "var(--hx-121212)", border: "1px solid rgb(var(--w) / 0.1)", borderRadius: 8, fontSize: 12 }} formatter={(v) => [money(Number(v), 2), "Collected"]} />
                  <Area type="monotone" dataKey="collected" stroke="#30D158" fill="url(#col)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-3">
            <div className="rounded-[12px] p-4" style={card}>
              <div className="text-[12px] font-semibold text-[color:var(--hx-f5f5f7)] mb-2">Pipeline by stage <span className="font-normal text-[color:var(--hx-6e6e73)]">· CRM leads, not archived · {d.wonInRange} won in range</span></div>
              <table className="w-full text-[12.5px]"><tbody>
                {d.pipeline.filter((p) => p.count > 0).length === 0 ? <tr><td className="py-2 text-[color:var(--hx-6e6e73)]">No leads in the pipeline yet.</td></tr> : d.pipeline.filter((p) => p.count > 0).map((p) => <tr key={p.stage} style={{ borderTop: "1px solid rgb(var(--w) / 0.05)" }}><td className="py-1.5 text-[color:var(--hx-d0d0d0)]">{p.label}</td><td className="py-1.5 text-right tabular-nums text-[color:var(--hx-f5f5f7)]">{p.count}</td><td className="py-1.5 text-right tabular-nums text-[color:var(--hx-6e6e73)] w-[120px]">{p.estValue != null ? `${money(p.estValue)}/mo` : "—"}</td></tr>)}
              </tbody></table>
            </div>
            <div className="flex flex-col gap-3">
              <div className="rounded-[12px] p-4" style={card}>
                <div className="text-[12px] font-semibold text-[color:var(--hx-f5f5f7)] mb-2">Clients by plan</div>
                {d.clients.byPlan.length === 0 ? <div className="text-[12.5px] text-[color:var(--hx-6e6e73)]">No paying clients yet.</div> : <table className="w-full text-[12.5px]"><tbody>{d.clients.byPlan.map((p) => <tr key={p.planKey} style={{ borderTop: "1px solid rgb(var(--w) / 0.05)" }}><td className="py-1.5 text-[color:var(--hx-d0d0d0)]">{p.label}</td><td className="py-1.5 text-right tabular-nums text-[color:var(--hx-f5f5f7)]">{p.count}</td><td className="py-1.5 text-right tabular-nums text-[color:var(--hx-6e6e73)] w-[120px]">{money(p.monthlyUsd)}/mo</td></tr>)}</tbody></table>}
                <div className="text-[11px] text-[color:var(--hx-6e6e73)] mt-2">MRR basis: {d.mrr.basis}.</div>
              </div>
              <div className="rounded-[12px] p-4" style={card}>
                <div className="text-[12px] font-semibold text-[color:var(--hx-f5f5f7)] mb-1">Booked in the CRM <span className="font-normal text-[color:var(--hx-6e6e73)]">· revenue_events, reps' closed deals</span></div>
                <div className="text-[18px] font-semibold text-[color:var(--hx-f5f5f7)] tabular-nums">{money(d.booked.total)}</div>
                <div className="text-[11.5px] text-[color:var(--hx-6e6e73)]">new sales {money(d.booked.newSales)} · renewals/upgrades {money(d.booked.renewals)} · refunds {money(d.booked.refunds)} · {d.booked.count} event{d.booked.count === 1 ? "" : "s"}. Booked ≠ collected: this is what reps recorded; "Collected" above is money that actually arrived.</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
