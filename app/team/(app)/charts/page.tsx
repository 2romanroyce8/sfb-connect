import { resolveAnalyticsScope } from "@/lib/team/analytics/permissions";
import { getRevenueAnalytics } from "@/lib/team/analytics/revenue";
import { isStripeConfigured } from "@/lib/billing/stripe";
import AnalyticsTabs from "@/components/team/analytics/AnalyticsTabs";

export default async function ChartsPage() {
  const scope = await resolveAnalyticsScope(null);
  const initial = await getRevenueAnalytics({ scope, range: "30d", planFilter: null });

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <div className="text-[20px] font-semibold text-[#F5F5F7]">Analytics</div>
        <div className="text-[13px] text-[#6E6E73] mt-1">Sales by rep · company performance from our records · a read-only mirror of Stripe.</div>
      </div>
      <AnalyticsTabs initial={initial} isOwner={scope.isOwner} stripeConfigured={isStripeConfigured()} />
    </div>
  );
}
