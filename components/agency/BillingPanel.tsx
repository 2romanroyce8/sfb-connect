"use client";
import { useState } from "react";

type Row = { subscription_status: string | null; current_period_end: string | null; cancel_at_period_end: boolean; connect_account_id: string | null; connect_charges_enabled: boolean; connect_payouts_enabled: boolean; connect_details_submitted: boolean } | null;
const card = { background: "var(--hx-111111)", border: "1px solid rgb(var(--w) / 0.07)" };
export default function BillingPanel({ enabled, canManage, row }: { enabled: boolean; canManage: boolean; row: Row }) {
  const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  async function go(action: string) {
    setBusy(action); setErr(null);
    try { const r = await fetch("/api/app/billing", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) }); const j = await r.json().catch(() => ({})); if (!r.ok || !j.url) throw new Error(j.error || "That didn't work."); window.location.href = j.url; }
    catch (e) { setErr(e instanceof Error ? e.message : "That didn't work."); setBusy(null); }
  }
  if (!enabled) return <div className="mt-5 rounded-[14px] p-5" style={card}><div className="text-[14px] font-medium">Billing isn&apos;t switched on yet</div><p className="text-[13px] text-[color:var(--hx-a1a1a6)] mt-1.5">Your workspace is free for now. When billing opens, the platform is $49 per month and you&apos;ll connect your own Stripe account here so your clients can pay you directly.</p></div>;
  const active = !!row?.subscription_status && ["active", "trialing"].includes(row.subscription_status);
  const btn = "h-[36px] px-4 rounded-[8px] text-[12.5px] font-semibold disabled:opacity-40";
  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="rounded-[14px] p-5" style={card}>
        <div className="text-[12px] uppercase tracking-wide text-[color:var(--hx-6e6e73)]">Platform subscription</div>
        <div className="text-[15px] font-medium mt-2">{active ? "Active · $49 per month" : row?.subscription_status ? `Status: ${row.subscription_status.replace("_", " ")}` : "Not subscribed"}</div>
        {row?.current_period_end && <div className="text-[12.5px] text-[color:var(--hx-a1a1a6)] mt-1">{row.cancel_at_period_end ? "Ends" : "Renews"} {new Date(row.current_period_end).toLocaleDateString()}</div>}
        {canManage && <div className="mt-4 flex gap-2">{active || row?.subscription_status === "past_due" ? <button disabled={busy !== null} onClick={() => void go("portal")} className={btn} style={{ border: "1px solid rgb(var(--w) / 0.14)" }}>Manage billing</button> : <button disabled={busy !== null} onClick={() => void go("checkout")} className={`${btn} bg-white text-black`}>{busy === "checkout" ? "Opening…" : "Subscribe — $49/month"}</button>}</div>}
      </div>
      <div className="rounded-[14px] p-5" style={card}>
        <div className="text-[12px] uppercase tracking-wide text-[color:var(--hx-6e6e73)]">Get paid by your clients (Stripe Connect)</div>
        <div className="text-[15px] font-medium mt-2">{row?.connect_charges_enabled ? "Connected · ready to accept payments" : row?.connect_account_id ? (row.connect_details_submitted ? "Submitted · Stripe is reviewing" : "Started · finish setting up") : "Not connected"}</div>
        <p className="text-[12.5px] text-[color:var(--hx-a1a1a6)] mt-1">You complete Stripe&apos;s own identity and bank steps; we never see your bank details. {row?.connect_payouts_enabled ? "Payouts are enabled." : ""}</p>
        {canManage && !row?.connect_charges_enabled && <button disabled={busy !== null} onClick={() => void go("connect")} className={`${btn} mt-4`} style={{ border: "1px solid rgb(var(--w) / 0.14)" }}>{busy === "connect" ? "Opening…" : row?.connect_account_id ? "Continue Stripe setup" : "Connect Stripe"}</button>}
      </div>
      {err && <div role="alert" className="text-[13px]" style={{ color: "var(--hx-ff453a)" }}>{err}</div>}
    </div>
  );
}
