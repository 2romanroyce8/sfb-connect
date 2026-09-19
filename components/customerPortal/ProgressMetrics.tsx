import type { ProgressMetrics } from "@/lib/customerPortal/progress";

export default function ProgressMetricsGrid({ metrics }: { metrics: ProgressMetrics }) {
  const rows: { label: string; value: number }[] = [
    { label: "Tracked Queries", value: metrics.trackedQueries },
    { label: "Detected Queries", value: metrics.detectedQueries },
    { label: "Platforms Tested", value: metrics.platformsTested },
    { label: "Findings Resolved", value: metrics.findingsResolved },
    { label: "Recommendations Completed", value: metrics.recommendationsCompleted },
    { label: "Reports Generated", value: metrics.reportsGenerated },
  ];

  return (
    <section className="mb-8">
      <h2 className="text-[13px] font-semibold text-neutral-900 mb-3">Progress Metrics</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {rows.map((r) => (
          <div key={r.label} className="border border-neutral-200 rounded-xl p-4">
            <div className="text-[20px] font-semibold text-neutral-900">{r.value}</div>
            <div className="text-[11.5px] text-neutral-500 mt-0.5">{r.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
