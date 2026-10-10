import { redirect } from "next/navigation";
import { getCustomerContext } from "@/lib/customerPortal/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import CustomerIntegrations from "@/components/customerPortal/CustomerIntegrations";
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const result = await getCustomerContext("/dashboard/integrations");
  if (result.status === "no_customer") redirect("/dashboard/no-membership");
  const { context } = result;
  const { data: biz } = await createSupabaseServerClient().from("businesses").select("is_sandbox").eq("id", context.business.id).maybeSingle();
  return (
    <div>
      <div className="mb-8"><h1 className="text-[26px] font-semibold text-neutral-900 tracking-tight">Integrations</h1><div className="text-[13px] text-neutral-500 mt-1">Connect the tools your agent works inside. {context.business.legalName}</div></div>
      <CustomerIntegrations isSandbox={!!biz?.is_sandbox} />
    </div>
  );
}
