import type { OnboardingStage } from "@/lib/customerPortal/overview";

const STATE_LABEL: Record<OnboardingStage["state"], string> = {
  complete: "Complete",
  running: "Running",
  queued: "Waiting",
};

export default function OverviewOnboarding({ stages }: { stages: OnboardingStage[] }) {
  return (
    <section className="mb-10 border border-neutral-200 rounded-2xl p-7">
      <h2 className="text-[16px] font-semibold text-neutral-900 mb-1">Welcome to SFB Connect</h2>
      <p className="text-[13px] text-neutral-500 mb-5">We&apos;re building your AI presence system.</p>
      <div className="flex flex-col gap-3">
        {stages.map((s) => (
          <div key={s.key} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className={`w-2 h-2 rounded-full ${
                  s.state === "complete" ? "bg-emerald-500" : s.state === "running" ? "bg-amber-500" : "bg-neutral-200"
                }`}
              />
              <span className={`text-[13.5px] ${s.state === "queued" ? "text-neutral-400" : "text-neutral-800"}`}>{s.label}</span>
            </div>
            <span className="text-[11.5px] text-neutral-400">{STATE_LABEL[s.state]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
