import { redirect } from "next/navigation";
import { getCustomerContext } from "@/lib/customerPortal/context";
import { getPresenceSummary } from "@/lib/customerPortal/overview";
import { getPresenceHistory, getProgressMetrics, getWhatChangedFeed } from "@/lib/customerPortal/progress";
import PresenceTrendChart from "@/components/customerPortal/PresenceTrendChart";
import ProgressMetricsGrid from "@/components/customerPortal/ProgressMetrics";
import WhatChanged from "@/components/customerPortal/WhatChanged";

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export default async function ProgressPage() {
  const result = await getCustomerContext("/dashboard/progress");
  if (result.status === "no_customer") redirect("/dashboard/no-membership");
  const { context } = result;

  const [presence, history, metrics, changes] = await Promise.all([
    getPresenceSummary(context.business.id),
    getPresenceHistory(context.business.id, null),
    getProgressMetrics(context.business.id),
    getWhatChangedFeed(context.business.id),
  ]);

  return (
    <div>
      <h1 className="text-[22px] font-semibold text-neutral-900 mb-6">Your Progress</h1>

      <section className="mb-8 border border-neutral-200 rounded-2xl p-7">
        {presence.status === "no_data" && <div className="text-[14px] text-neutral-600">No measurements recorded yet.</div>}
        {presence.status === "single" && (
          <div className="text-[14px] text-neutral-600">
            Baseline established — more measurements are needed to calculate progress.
          </div>
        )}
        {presence.status === "incomparable" && (
          <div className="text-[14px] text-neutral-600">
            Your latest measurement used an updated methodology, so a direct change from the earlier baseline can&apos;t be calculated yet.
          </div>
        )}
        {presence.status === "trend" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-[10.5px] uppercase tracking-wide text-neutral-400 mb-1">Baseline</div>
              <div className="text-[20px] font-semibold text-neutral-900">{presence.baseline.overall_score}</div>
            </div>
            <div>
              <div className="text-[10.5px] uppercase tracking-wide text-neutral-400 mb-1">Current</div>
              <div className="text-[20px] font-semibold text-neutral-900">{presence.current.overall_score}</div>
            </div>
            <div>
              <div className="text-[10.5px] uppercase tracking-wide text-neutral-400 mb-1">Change Since Baseline</div>
              <div className={`text-[20px] font-semibold ${presence.changePoints >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {presence.changePoints > 0 ? "+" : ""}
                {presence.changePoints} pts
              </div>
            </div>
            <div>
              <div className="text-[10.5px] uppercase tracking-wide text-neutral-400 mb-1">Time Since Baseline</div>
              <div className="text-[13px] font-medium text-neutral-700 pt-1.5">{daysSince(presence.baseline.recorded_at)} days</div>
            </div>
          </div>
        )}
      </section>

      <PresenceTrendChart points={history} />
      <ProgressMetricsGrid metrics={metrics} />
      <WhatChanged events={changes} />
    </div>
  );
}
