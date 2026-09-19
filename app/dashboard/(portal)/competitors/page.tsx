import { redirect } from "next/navigation";
import { getCustomerContext } from "@/lib/customerPortal/context";
import { getCompetitorSummaries } from "@/lib/customerPortal/competitors";
import CompetitorsView from "@/components/customerPortal/CompetitorsView";

export default async function CompetitorsPage() {
  const result = await getCustomerContext("/dashboard/competitors");
  if (result.status === "no_customer") redirect("/dashboard/no-membership");
  const { context } = result;

  const competitors = await getCompetitorSummaries(context.business.id);

  return (
    <div>
      <h1 className="text-[22px] font-semibold text-neutral-900 mb-6">Competitors</h1>
      <CompetitorsView competitors={competitors} />
    </div>
  );
}
