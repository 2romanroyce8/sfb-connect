import { redirect } from "next/navigation";
import { getCustomerContext } from "@/lib/customerPortal/context";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { loadAgentState } from "@/lib/customerPortal/agent";
import AgentDashboard from "@/components/customerPortal/AgentDashboard";
export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const result = await getCustomerContext("/dashboard/agent");
  if (result.status === "no_customer") redirect("/dashboard/no-membership");
  const { context } = result;
  const supabase = createSupabaseServerClient();
  const state = await loadAgentState(supabase, context.business.id);
  let overseer: { name: string; role: string } | null = null;
  const { data: biz } = await createSupabaseServiceClient().from("businesses").select("agent_overseer_id").eq("id", context.business.id).maybeSingle();
  if (biz?.agent_overseer_id) { const { data: u } = await createSupabaseServiceClient().from("users").select("full_name, team_role").eq("id", biz.agent_overseer_id).maybeSingle(); if (u?.full_name) overseer = { name: u.full_name, role: u.team_role === "owner" ? "SFB Connect — Founder & overseer" : "SFB Connect — Agent overseer" }; }
  const weekAgo = Date.now() - 7 * 86400000;
  const week = state.ledger.filter((r) => new Date(r.created_at).getTime() >= weekAgo && r.type === "USAGE");
  return (
    <div>
      <div className="mb-8"><h1 className="text-[26px] font-semibold text-neutral-900 tracking-tight">Your SFB Agent</h1><div className="text-[13px] text-neutral-500 mt-1">{context.business.legalName}</div></div>
      <AgentDashboard tierName={state.tier?.name ?? null} isSandbox={state.isSandbox} stockName={state.stock?.name ?? null} trialExpiresAt={state.trialExpiresAt} trialExpired={state.trialExpired} balance={state.balance} allotment={state.allotment} monthlyRemaining={state.monthlyRemaining} topupBalance={state.topupBalance} creditLevel={state.creditLevel} usedPct={state.usedPct} agentStatus={state.agentStatus} workPausedReason={state.workPausedReason} nextRefill={state.nextRefill} capabilities={state.capabilities} ledger={state.ledger} priceListVisible={state.priceListVisible} overseer={overseer} capabilityLimit={state.tier?.capabilityLimit ?? 8} weekStats={{ done: week.filter((r) => r.amount < 0).length, pending: 0, approved: week.filter((r) => r.amount < 0).length }} />
    </div>
  );
}
