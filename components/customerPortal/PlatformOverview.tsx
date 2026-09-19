import type { PlatformStatus } from "@/lib/customerPortal/presence";

const STATUS_STYLE: Record<PlatformStatus, string> = {
  detected: "bg-emerald-50 text-emerald-700 border-emerald-200",
  not_detected: "bg-neutral-50 text-neutral-600 border-neutral-200",
  not_yet_tested: "bg-neutral-50 text-neutral-400 border-neutral-200",
  inconclusive: "bg-amber-50 text-amber-700 border-amber-200",
  error: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_LABEL: Record<PlatformStatus, string> = {
  detected: "Detected",
  not_detected: "Not Detected",
  not_yet_tested: "Not Yet Tested",
  inconclusive: "Inconclusive",
  error: "Error",
};

export default function PlatformOverview({
  summary,
  labels,
  platforms,
}: {
  summary: Record<string, PlatformStatus>;
  labels: Record<string, string>;
  platforms: string[];
}) {
  return (
    <section className="mb-8">
      <h2 className="text-[13px] font-semibold text-neutral-900 mb-3">Where You&apos;re Being Found</h2>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {platforms.map((p) => (
          <div key={p} className="border border-neutral-200 rounded-xl p-4">
            <div className="text-[13px] font-medium text-neutral-900 mb-2">{labels[p]}</div>
            <span className={`inline-flex text-[10.5px] font-medium rounded-full px-2 py-0.5 border ${STATUS_STYLE[summary[p]]}`}>
              {STATUS_LABEL[summary[p]]}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
