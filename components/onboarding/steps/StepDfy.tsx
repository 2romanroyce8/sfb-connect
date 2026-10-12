"use client";

import { useEffect, useState } from "react";
import BookDemoCall from "@/components/demo/BookDemoCall";
import { DFY_OFFER_LINE } from "@/lib/billing/dfyConstants";

/** Step 9 — "Want us to run it?" Two done-for-you options or keep going. Self-serve is one click, never hidden. */
export default function StepDfy({ dfyChoice, purchaseFlag, prefill, onDone }: { dfyChoice: string | null; purchaseFlag: string | null; prefill: { name: string | null; email: string | null; phone: string | null; website: string | null }; onDone: () => void }) {
  const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null); const [paid, setPaid] = useState(dfyChoice === "install");
  const post = async (body: Record<string, unknown>) => { const r = await fetch("/api/dashboard/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "Request failed."); return j; };
  // Returned from Stripe: the webhook marks the purchase within seconds — poll until it has.
  useEffect(() => { if (purchaseFlag !== "success" || paid) return; let n = 0; const id = setInterval(async () => { n++; const r = await fetch("/api/dashboard/onboarding", { cache: "no-store" }); const j = await r.json(); if (j?.row?.dfy_choice === "install") { setPaid(true); clearInterval(id); } if (n > 20) clearInterval(id); }, 3000); return () => clearInterval(id); }, [purchaseFlag, paid]);
  const buy = async () => { setBusy("buy"); setErr(null); try { const j = await post({ action: "dfy_checkout" }); window.location.href = j.checkoutUrl; } catch (e) { setErr(e instanceof Error ? e.message : "Checkout failed."); setBusy(null); } };
  const choose = async (choice: "self_serve" | "retainer_talk", demoCallId?: string | null) => { setBusy(choice); setErr(null); try { await post({ action: "dfy_choose", data: { choice, demo_call_id: demoCallId ?? null } }); onDone(); } catch (e) { setErr(e instanceof Error ? e.message : "Could not save."); } finally { setBusy(null); } };
  // Option B: a completed booking closes the popup → step 10, same as "I'll run it myself". Closing without booking stays here.
  const onDemoClose = ({ booked, callId }: { booked: boolean; callId: string | null }) => { if (booked) void choose("retainer_talk", callId); };

  if (paid) return (
    <div className="border border-emerald-200 bg-emerald-50 rounded-2xl p-6">
      <div className="text-[15px] font-semibold text-emerald-900">You&apos;re on the done-for-you install.</div>
      <p className="text-[13.5px] text-emerald-800 mt-2">Payment received. The team has your account now — nothing you set up resets, and we take it from here for the first 90 days. You can still watch everything on the dashboard, and the next two steps stay open if you want to see the first campaign go out.</p>
      <div className="mt-4"><button onClick={onDone} className="h-[44px] px-6 rounded-full bg-neutral-900 text-white text-[14px] font-semibold">Continue →</button></div>
    </div>
  );
  return (
    <div className="flex flex-col gap-4">
      {purchaseFlag === "success" && <div className="rounded-xl px-4 py-3 text-[13px] bg-emerald-50 text-emerald-800 border border-emerald-200">Payment received — confirming with Stripe…</div>}
      {purchaseFlag === "canceled" && <div className="rounded-xl px-4 py-3 text-[13px] bg-neutral-50 text-neutral-700 border border-neutral-200">Checkout closed — nothing was charged. Pick an option below whenever you&apos;re ready.</div>}
      <p className="text-[13.5px] text-neutral-600">Everything so far is set. From here you can run the agent yourself, or we run it for you. Both paths lead to the same place — your first campaign.</p>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="border border-neutral-900 rounded-2xl p-5 flex flex-col">
          <div className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">Option A</div>
          <div className="text-[18px] font-semibold text-neutral-900 mt-1">Done-for-you install</div>
          <div className="text-[14px] text-neutral-700 mt-1">{DFY_OFFER_LINE}</div>
          <ul className="text-[13px] text-neutral-600 mt-3 flex flex-col gap-1 list-disc pl-4"><li>We finish setup and run your first campaigns</li><li>Weekly check-ins for 90 days</li><li>Nothing you&apos;ve configured resets</li></ul>
          <button onClick={buy} disabled={!!busy} className="mt-4 h-[44px] px-6 rounded-full bg-neutral-900 text-white text-[14px] font-semibold disabled:opacity-60">{busy === "buy" ? "Opening checkout…" : "Buy the install — $8,000"}</button>
          <div className="text-[11.5px] text-neutral-400 mt-2">One-time. Secure checkout by Stripe; your plan is unchanged.</div>
        </div>
        <div className="border border-neutral-200 rounded-2xl p-5 flex flex-col">
          <div className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">Option B</div>
          <div className="text-[18px] font-semibold text-neutral-900 mt-1">Monthly retainer</div>
          <div className="text-[14px] text-neutral-700 mt-1">Ongoing hands-on management. Scoped to your business — let&apos;s talk it through.</div>
          <div className="mt-auto pt-4 flex items-center gap-3 flex-wrap">
            <BookDemoCall source="onboarding-dfy" prefill={prefill} onClose={onDemoClose} />
            <span className="text-[12.5px] text-neutral-500">{busy === "retainer_talk" ? "Booked — taking you to your first campaign…" : "Talk to us — no price until we've scoped it."}</span>
          </div>
        </div>
      </div>
      {err && <div className="text-[13px] text-red-600">{err}</div>}
      <div className="flex items-center gap-3 pt-1">
        <button onClick={() => void choose("self_serve")} disabled={!!busy} className="h-[44px] px-6 rounded-full border border-neutral-300 text-[14px] font-semibold text-neutral-900 disabled:opacity-60">{busy === "self_serve" ? "Saving…" : "I'll run it myself →"}</button>
        <span className="text-[12.5px] text-neutral-400">You can come back to either option from the dashboard any time.</span>
      </div>
    </div>
  );
}
