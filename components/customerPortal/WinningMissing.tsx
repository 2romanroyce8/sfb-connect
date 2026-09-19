import type { LatestObservation } from "@/lib/customerPortal/presence";

/**
 * Both modules derive ONLY from real observation rows -- "winning" counts
 * genuine `detected` rows, "missing" counts genuine `not_detected` rows.
 * `not_tested` never counts as a miss (that distinction is the whole point
 * of having a separate status for it).
 */
export default function WinningMissing({ observations, labels }: { observations: LatestObservation[]; labels: Record<string, string> }) {
  const winning = observations.filter((o) => o.status === "detected");
  const missing = observations.filter((o) => o.status === "not_detected");

  if (winning.length === 0 && missing.length === 0) return null;

  return (
    <div className="grid sm:grid-cols-2 gap-4 mb-8">
      {winning.length > 0 && (
        <section className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-5">
          <h3 className="text-[12.5px] font-semibold text-emerald-800 mb-2">Where You&apos;re Winning</h3>
          <p className="text-[12.5px] text-neutral-600">
            Detected across {winning.length} tracked {winning.length === 1 ? "query" : "queries"}
            {winning.some((w) => w.previous_status === "not_detected") ? " -- improved on at least one since last check." : "."}
          </p>
        </section>
      )}
      {missing.length > 0 && (
        <section className="border border-neutral-200 rounded-xl p-5">
          <h3 className="text-[12.5px] font-semibold text-neutral-800 mb-2">Where You&apos;re Missing</h3>
          <div className="flex flex-col gap-1.5">
            {missing.slice(0, 4).map((m) => (
              <div key={m.id} className="text-[12.5px] text-neutral-600">
                &ldquo;{m.query_text}&rdquo; on {labels[m.platform]}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
