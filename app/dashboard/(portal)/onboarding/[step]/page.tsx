import { notFound, redirect } from "next/navigation";
import { getCustomerContext } from "@/lib/customerPortal/context";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { loadOnboarding } from "@/lib/onboarding/state";
import { stepBySlug } from "@/lib/onboarding/flow";
import { CAPABILITIES } from "@/lib/agentProgram/config";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import { getAgentFeed } from "@/lib/customerPortal/agentFeed";
export const dynamic = "force-dynamic";

export default async function OnboardingStepPage({ params, searchParams }: { params: { step: string }; searchParams: Record<string, string | undefined> }) {
  const def = stepBySlug(params.step); if (!def) notFound();
  const result = await getCustomerContext(`/dashboard/onboarding/${params.step}`);
  if (result.status === "no_customer") redirect("/dashboard/no-membership");
  const service = createSupabaseServiceClient();
  const { state, row, business, integrations } = await loadOnboarding(service, result.context.business.id);
  const { count: prospectCount } = await service.from("outbound_prospects").select("id", { count: "exact", head: true }).eq("business_id", business.id);
  const [{ data: owner }, feed] = await Promise.all([service.from("users").select("full_name, email").eq("id", business.owner_id).maybeSingle(), def.no === 11 ? getAgentFeed(service, business.id) : Promise.resolve([])]);
  const prefill = { name: (owner?.full_name as string) ?? null, email: (owner?.email as string) ?? null, phone: business.phone, website: business.website };
  const { data: caps } = await service.from("business_capabilities").select("capability_key, enabled").eq("business_id", business.id);
  const capabilities = CAPABILITIES.map((c) => ({ key: c.key, name: c.name, short: c.short, enabled: caps?.find((x) => x.capability_key === c.key)?.enabled ?? true }));
  const flash = searchParams.connected ? { ok: true, text: `Connected ${searchParams.connected}.` } : searchParams.error ? { ok: false, text: searchParams.error } : null;
  return <OnboardingShell state={state} step={def} business={business} stepData={(row.step_data?.[String(def.no)] as Record<string, unknown> | undefined) ?? null} integrations={integrations} capabilities={capabilities} flash={flash} prospectCount={prospectCount ?? 0} dfyChoice={row.dfy_choice} purchaseFlag={searchParams.purchase ?? null} prefill={prefill} feed={feed} />;
}
