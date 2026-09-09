import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveAnalyticsScope } from "@/lib/team/analytics/permissions";
import { getRevenueAnalytics } from "@/lib/team/analytics/revenue";
import RevenueAnalyticsView from "@/components/team/analytics/RevenueAnalyticsView";

export default async function ChartsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const scope = await resolveAnalyticsScope(null);
  const initial = await getRevenueAnalytics({ scope, range: "30d", planFilter: null });

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <div className="text-[20px] font-semibold text-[#F5F5F7]">Analytics</div>
        <div className="text-[13px] text-[#6E6E73] mt-1">Revenue, growth, and company performance.</div>
      </div>
      <RevenueAnalyticsView initial={initial} isOwner={scope.isOwner} />
    </div>
  );
}
