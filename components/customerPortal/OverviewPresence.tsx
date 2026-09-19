import type { PresenceSummary } from "@/lib/customerPortal/overview";

/**
 * The dominant Overview metric. NEVER fabricates a number -- if there is
 * no real presence_scores row yet, this shows an honest
 * baseline-establishment state, not 0%.
 *
 * Change is always expressed in POINTS (current - baseline on a 0-100
 * score), never "+N%" -- that would misstate what the metric is. When two
 * scores were computed under different scoring methodologies, no delta is
 * shown at all rather than a misleading one.
 */
export default function OverviewPresence({ presence }: { presence: PresenceSummary }) {
  if (presence.status === "no_data") {
    return (
      <section className="mb-10 border border-neutral-200 rounded-2xl p-7">
        <div className="text-[12px] font-medium uppercase tracking-wide text-neutral-400 mb-2">AI Presence</div>
        <div className="text-[22px] font-semibold text-neutral-900 mb-1">Establishing your baseline</div>
        <p className="text-[13px] text-neutral-500 max-w-[420px]">
          We&apos;re establishing your baseline across supported AI platforms and sources. Your first AI Presence score
          will appear here once that baseline scan completes.
        </p>
      </section>
    );
  }

  const { current } = presence;

  return (
    <section className="mb-10 border border-neutral-200 rounded-2xl p-7">
      <div className="text-[12px] font-medium uppercase tracking-wide text-neutral-400 mb-2">AI Presence</div>
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-[44px] font-semibold text-neutral-900 leading-none tracking-tight">{current.overall_score}</span>
        <span className="text-[15px] text-neutral-400">/ 100</span>
      </div>
      {presence.status === "trend" && (
        <div className={`text-[13px] font-medium ${presence.changePoints > 0 ? "text-emerald-600" : presence.changePoints < 0 ? "text-red-600" : "text-neutral-500"}`}>
          {presence.changePoints > 0 ? "+" : ""}
          {presence.changePoints} points since baseline
        </div>
      )}
      {presence.status === "single" && <div className="text-[13px] text-neutral-500">This is your baseline measurement.</div>}
      {presence.status === "incomparable" && (
        <div className="text-[13px] text-neutral-500">
          Baseline was measured under a different methodology -- change isn&apos;t directly comparable yet.
        </div>
      )}
    </section>
  );
}
