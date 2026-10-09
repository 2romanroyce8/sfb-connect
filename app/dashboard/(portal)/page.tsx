import { redirect } from "next/navigation";
import Link from "next/link";
import { getCustomerContext } from "@/lib/customerPortal/context";
import { getPresenceSummary, getRecentFindings, getRecentActivity, getOnboardingStages } from "@/lib/customerPortal/overview";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import OverviewOnboarding from "@/components/customerPortal/OverviewOnboarding";
import OverviewPresence from "@/components/customerPortal/OverviewPresence";
import OverviewActivity from "@/components/customerPortal/OverviewActivity";
import OverviewPlanSummary from "@/components/customerPortal/OverviewPlanSummary";
import AgentPanel from "@/components/customerPortal/AgentPanel";
import { fetchAgentModules } from "@/lib/agentProgram/modules";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function OverviewPage() {
  const result = await getCustomerContext("/dashboard");
  if (result.status === "no_customer") redirect("/dashboard/no-membership");
  const { context } = result;

  const supabase = createSupabaseServerClient();

  // Agent panel inputs: module statuses (public), the business's own credit
  // receipts (RLS), and the assigned overseer's name/role (read through the
  // service client because customers cannot read the team users table).
  const agentData = (async () => {
    const [modules, { data: receipts }, { data: biz }] = await Promise.all([
      fetchAgentModules(),
      supabase.from("credit_transactions").select("id, type, amount, balance_after, description, created_at").eq("business_id", context.business.id).order("created_at", { ascending: false }).limit(6),
      createSupabaseServiceClient().from("businesses").select("agent_overseer_id").eq("id", context.business.id).maybeSingle(),
    ]);
    let overseer: { name: string; role: string } | null = null;
    if (biz?.agent_overseer_id) {
      const { data: u } = await createSupabaseServiceClient().from("users").select("full_name, team_role").eq("id", biz.agent_overseer_id).maybeSingle();
      if (u?.full_name) overseer = { name: u.full_name, role: u.team_role === "owner" ? "SFB Connect — Founder & overseer" : "SFB Connect — Agent overseer" };
    }
    return { modules, receipts: receipts ?? [], overseer };
  })();

  const [presence, findings, activity, stages, { data: opportunity }, agent] = await Promise.all([
    getPresenceSummary(context.business.id),
    getRecentFindings(context.business.id, 5),
    getRecentActivity(context.business.id, 8),
    getOnboardingStages(context.business.id),
    supabase
      .from("expansion_opportunities")
      .select("id, type, evidence, addon_products(id, name, base_price_cents)")
      .eq("business_id", context.business.id)
      .eq("status", "OPEN")
      .order("detected_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    agentData,
  ]);

  // "Established" vs "new customer" transition happens automatically based
  // on real state -- no manual toggle. A business counts as established
  // once it has at least one real presence measurement.
  const isEstablished = presence.status !== "no_data";

  const lastUpdated = isEstablished && (presence.status === "single" || presence.status === "trend" || presence.status === "incomparable")
    ? presence.current.recorded_at
    : null;

  return (
    <div>
      <div className="mb-10">
        <div className="text-[13px] text-neutral-500 mb-1">
          {greeting()}, {context.firstName || "there"}
        </div>
        <h1 className="text-[26px] font-semibold text-neutral-900 tracking-tight">{context.business.legalName}</h1>
        <div className="flex items-center gap-2 mt-2">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            SFB Active
          </span>
          <span className="text-[12px] text-neutral-400">
            {lastUpdated
              ? `Last updated ${new Date(lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
              : "Baseline not established yet"}
          </span>
        </div>
      </div>

      <Link href="/dashboard/presence" className="block">
        <OverviewPresence presence={presence} />
      </Link>
      {isEstablished && (
        <div className="flex gap-4 -mt-8 mb-10">
          <Link href="/dashboard/presence" className="text-[12px] font-medium text-neutral-900 underline underline-offset-2">
            View Presence →
          </Link>
          <Link href="/dashboard/progress" className="text-[12px] font-medium text-neutral-900 underline underline-offset-2">
            View Progress →
          </Link>
        </div>
      )}

      {!isEstablished && <OverviewOnboarding stages={stages} />}

      {isEstablished && findings.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-semibold text-neutral-900">Recent Findings</h2>
            <Link href="/dashboard/actions" className="text-[11.5px] font-medium text-neutral-500 underline underline-offset-2">
              View Actions →
            </Link>
          </div>
          <div className="border border-neutral-200 rounded-xl divide-y divide-neutral-100">
            {findings.map((f) => (
              <div key={f.id} className="p-4 flex items-start justify-between gap-4">
                <div>
                  <div className="text-[13px] text-neutral-900 mb-0.5">{f.finding}</div>
                  <div className="text-[11.5px] text-neutral-400">
                    {f.category || "General"} · {f.severity}
                  </div>
                </div>
                <span
                  className={`shrink-0 text-[10.5px] font-medium rounded-full px-2 py-0.5 ${
                    f.resolved ? "bg-neutral-100 text-neutral-500" : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}
                >
                  {f.resolved ? "Resolved" : "Open"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <AgentPanel modules={agent.modules} creditBalance={context.entitlements.creditBalance} receipts={agent.receipts} overseer={agent.overseer} />

      <OverviewActivity activity={activity} />

      <OverviewPlanSummary
        planLabel={context.planLabel}
        creditBalance={context.entitlements.creditBalance}
        activeAddonCount={context.entitlements.activeAddonKeys.length}
      />

      {opportunity && (
        <section className="mb-10">
          <h2 className="text-[13px] font-semibold text-neutral-900 mb-3">Next Opportunity</h2>
          <div className="border border-neutral-200 rounded-xl p-5 flex items-center justify-between gap-4">
            <div>
              <div className="text-[13px] font-medium text-neutral-900 mb-1">
                {(opportunity as any).addon_products?.name || opportunity.type}
              </div>
              <div className="text-[12.5px] text-neutral-500">{opportunity.evidence}</div>
            </div>
            <Link
              href="/dashboard/billing"
              className="shrink-0 text-[12.5px] font-medium text-white bg-neutral-900 rounded-full px-4 py-2 whitespace-nowrap"
            >
              View in Billing
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
