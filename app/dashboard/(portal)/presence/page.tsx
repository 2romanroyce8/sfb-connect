import { redirect } from "next/navigation";
import { getCustomerContext } from "@/lib/customerPortal/context";
import { getPresenceSummary } from "@/lib/customerPortal/overview";
import { getLatestObservations, summarizeByPlatform, PLATFORMS, PLATFORM_LABELS } from "@/lib/customerPortal/presence";
import PresenceHeader from "@/components/customerPortal/PresenceHeader";
import PlatformOverview from "@/components/customerPortal/PlatformOverview";
import QueryExplorer from "@/components/customerPortal/QueryExplorer";
import WinningMissing from "@/components/customerPortal/WinningMissing";

export default async function PresencePage() {
  const result = await getCustomerContext("/dashboard/presence");
  if (result.status === "no_customer") redirect("/dashboard/no-membership");
  const { context } = result;

  const [presence, observations] = await Promise.all([
    getPresenceSummary(context.business.id),
    getLatestObservations(context.business.id),
  ]);

  const platformSummary = summarizeByPlatform(observations);

  return (
    <div>
      <h1 className="text-[22px] font-semibold text-neutral-900 mb-6">AI Presence</h1>
      <PresenceHeader presence={presence} />
      <PlatformOverview summary={platformSummary} labels={PLATFORM_LABELS} platforms={PLATFORMS as unknown as string[]} />
      <WinningMissing observations={observations} labels={PLATFORM_LABELS} />
      <QueryExplorer observations={observations} labels={PLATFORM_LABELS} businessId={context.business.id} />
    </div>
  );
}
