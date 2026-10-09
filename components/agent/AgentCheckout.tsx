"use client";

import { useState } from "react";
import type { Tier } from "@/lib/agentProgram/config";
import { fmtUsd } from "@/lib/agentProgram/config";

// "Get your agent" -> a two-field sheet (email + business name) -> Stripe
// Checkout. Amounts are display-only here; the server resolves them.
export default function AgentCheckout({ plan }: { plan: Tier }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const r = await fetch("/api/agent/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan: plan.key, email, businessName }) });
      const j = await r.json();
      if (!r.ok || !j.checkoutUrl) throw new Error(j.error || "Could not start checkout.");
      window.location.href = j.checkoutUrl;
    } catch (err) { setError(err instanceof Error ? err.message : "Could not start checkout."); setBusy(false); }
  };

  if (!open) return <button onClick={() => setOpen(true)} className="mt-8 inline-flex justify-center items-center bg-white text-black px-5 py-3 rounded-full text-[13.5px] font-semibold hover:opacity-85 transition-opacity">Get your agent →</button>;

  return (
    <form onSubmit={start} className="mt-6 flex flex-col gap-2.5">
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Work email" className="h-[42px] rounded-[9px] px-3 text-[13.5px] outline-none text-white placeholder:text-white/[0.35]" style={{ background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.12)" }} />
      <input type="text" required minLength={2} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business name" className="h-[42px] rounded-[9px] px-3 text-[13.5px] outline-none text-white placeholder:text-white/[0.35]" style={{ background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.12)" }} />
      <button type="submit" disabled={busy} className="h-[44px] inline-flex justify-center items-center bg-white text-black rounded-full text-[13.5px] font-semibold hover:opacity-85 transition-opacity disabled:opacity-60">{busy ? "Opening secure checkout…" : `Continue to checkout — ${fmtUsd(plan.monthlyUsd)}/mo + ${fmtUsd(plan.onboardingUsd)} onboarding`}</button>
      {error && <div className="text-[12px] text-[#FF9F9A]">{error}</div>}
      <div className="text-[11px] text-white/[0.4]">Secure payment by Stripe. Monthly plan cancels anytime; onboarding is a one-time charge. You&apos;ll receive a sign-in email for your SFB dashboard after payment.</div>
    </form>
  );
}
