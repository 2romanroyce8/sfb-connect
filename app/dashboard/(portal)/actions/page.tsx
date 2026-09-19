import { redirect } from "next/navigation";
import { getCustomerContext } from "@/lib/customerPortal/context";
import { getRecommendations, getAvailableActions, getReservations, getCreditHistory, getCreditSummary } from "@/lib/customerPortal/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ActionsView from "@/components/customerPortal/ActionsView";

export default async function ActionsPage() {
  const result = await getCustomerContext("/dashboard/actions");
  if (result.status === "no_customer") redirect("/dashboard/no-membership");
  const { context } = result;

  const supabase = createSupabaseServerClient();

  const [recommendations, catalogActions, reservations, creditHistory, creditSummary, { data: creditPackages }] = await Promise.all([
    getRecommendations(context.business.id),
    getAvailableActions(context.business.id),
    getReservations(context.business.id),
    getCreditHistory(context.business.id),
    getCreditSummary(context.business.id),
    supabase.from("credit_packages").select("id, name, credits, price_cents").eq("active", true).order("sort_order"),
  ]);

  return (
    <div>
      <h1 className="text-[22px] font-semibold text-neutral-900 mb-6">Actions</h1>
      <ActionsView
        recommendations={recommendations}
        catalogActions={catalogActions}
        reservations={reservations}
        creditHistory={creditHistory}
        creditSummary={creditSummary}
        creditPackages={creditPackages ?? []}
      />
    </div>
  );
}
