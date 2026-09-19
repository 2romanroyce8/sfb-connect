import type { PresenceSummary } from "@/lib/customerPortal/overview";

export default function PresenceHeader({ presence }: { presence: PresenceSummary }) {
  if (presence.status === "no_data") {
    return (
      <section className="mb-8 border border-neutral-200 rounded-2xl p-7">
        <div className="text-[12px] font-medium uppercase tracking-wide text-neutral-400 mb-2">AI Presence</div>
        <div className="text-[18px] font-semibold text-neutral-900">Establishing your AI presence baseline</div>
      </section>
    );
  }

  const { current } = presence;
  const baseline = presence.status === "trend" || presence.status === "incomparable" ? presence.baseline : null;

  return (
    <section className="mb-8 border border-neutral-200 rounded-2xl p-7">
      <div className="text-[12px] font-medium uppercase tracking-wide text-neutral-400 mb-4">AI Presence</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <div className="text-[10.5px] uppercase tracking-wide text-neutral-400 mb-1">Baseline</div>
          <div className="text-[20px] font-semibold text-neutral-900">{baseline ? baseline.overall_score : current.overall_score}</div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wide text-neutral-400 mb-1">Current</div>
          <div className="text-[20px] font-semibold text-neutral-900">{current.overall_score}</div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wide text-neutral-400 mb-1">Change</div>
          <div className="text-[20px] font-semibold text-neutral-900">
            {presence.status === "trend" ? `${presence.changePoints > 0 ? "+" : ""}${presence.changePoints}` : "—"}
          </div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wide text-neutral-400 mb-1">Last Analyzed</div>
          <div className="text-[13px] font-medium text-neutral-700 pt-1.5">
            {new Date(current.recorded_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </div>
        </div>
      </div>
      {presence.status === "single" && (
        <p className="text-[12.5px] text-neutral-500 mt-4">
          This is your baseline measurement. Progress will show here once a second comparable measurement is recorded.
        </p>
      )}
      {presence.status === "incomparable" && (
        <p className="text-[12.5px] text-neutral-500 mt-4">
          Your most recent measurement used an updated methodology, so it isn&apos;t directly comparable to the earlier baseline yet.
        </p>
      )}
    </section>
  );
}
