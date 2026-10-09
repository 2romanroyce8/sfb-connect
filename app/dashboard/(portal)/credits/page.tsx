import { redirect } from "next/navigation";
import Link from "next/link";
import { getCustomerContext } from "@/lib/customerPortal/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadAgentState } from "@/lib/customerPortal/agent";
import { CREDIT_PRICES, CAPABILITIES, TOP_UP_PACKS, CREDITS_PER_BOOKED_CALL, CREDITS_PAY_FOR_WORK, bookedCallsFor, fmtUsd } from "@/lib/agentProgram/config";
import CreditsTools from "@/components/customerPortal/CreditsTools";
export const dynamic = "force-dynamic";

export default async function CreditsPage() {
  const result = await getCustomerContext("/dashboard/credits");
  if (result.status === "no_customer") redirect("/dashboard/no-membership");
  const { context } = result;
  const supabase = createSupabaseServerClient();
  const [state, { data: packs }] = await Promise.all([loadAgentState(supabase, context.business.id), supabase.from("credit_packages").select("id, name, credits, price_cents").eq("active", true).order("sort_order")]);
  return (
    <div>
      <div className="mb-8"><h1 className="text-[26px] font-semibold text-neutral-900 tracking-tight">Credits</h1><div className="text-[13px] text-neutral-500 mt-1">{CREDITS_PAY_FOR_WORK}</div></div>
      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        <div className="border border-neutral-200 rounded-xl p-4"><div className="text-[11px] uppercase tracking-wide text-neutral-400 mb-1">Balance</div><div className="text-[24px] font-semibold text-neutral-900">{state.balance}</div></div>
        <div className="border border-neutral-200 rounded-xl p-4"><div className="text-[11px] uppercase tracking-wide text-neutral-400 mb-1">Monthly allotment</div><div className="text-[24px] font-semibold text-neutral-900">{state.allotment}</div><div className="text-[11.5px] text-neutral-400">spends first · never rolls over</div></div>
        <div className="border border-neutral-200 rounded-xl p-4"><div className="text-[11px] uppercase tracking-wide text-neutral-400 mb-1">{state.nextRefill ? "Next refill" : "Expiry"}</div><div className="text-[16px] font-medium text-neutral-900">{state.nextRefill ? new Date(state.nextRefill).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : state.trialExpiresAt ? new Date(state.trialExpiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</div></div>
      </div>
      <CreditsTools balance={state.balance} isSandbox={state.isSandbox} priceListVisible={state.priceListVisible} packs={(packs ?? []).map((p) => ({ ...p, usd: TOP_UP_PACKS.find((t) => t.credits === p.credits)?.usd ?? p.price_cents / 100 }))} ledger={state.ledger} creditsPerCall={CREDITS_PER_BOOKED_CALL} />
      {state.priceListVisible ? (
        <section className="mt-8"><h2 className="text-[13px] font-semibold text-neutral-900 mb-3">Credit price list</h2><div className="border border-neutral-200 rounded-xl divide-y divide-neutral-100">{CAPABILITIES.map((c) => <div key={c.key} className="px-4 py-3"><div className="text-[12px] font-semibold text-neutral-800 mb-1">{c.name}</div><ul className="grid sm:grid-cols-2 gap-x-6">{CREDIT_PRICES.filter((p) => p.capability === c.key).map((p) => <li key={p.key} className="flex justify-between text-[12.5px]"><span className="text-neutral-500">{p.label}</span><span className="tabular-nums text-neutral-900">{p.credits}</span></li>)}</ul></div>)}<div className="px-4 py-3 flex justify-between text-[12.5px]"><span className="text-neutral-500">Human review pass</span><span className="tabular-nums text-neutral-900">{CREDIT_PRICES.find((p) => p.key === "human.review_pass")?.credits}</span></div></div></section>
      ) : (
        <section className="mt-8 border border-neutral-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-3"><div><div className="text-[13.5px] font-medium text-neutral-900">Price list and top-ups unlock on a paid plan</div><div className="text-[12.5px] text-neutral-500 mt-0.5">Solo: {bookedCallsFor(150)} booked calls/month · Agency: {bookedCallsFor(500)}. Spend per action stays visible here on the trial.</div></div><Link href="/agent#pricing" className="text-[12.5px] font-semibold text-white bg-neutral-900 rounded-full px-4 py-2">Go live →</Link></section>
      )}
    </div>
  );
}
