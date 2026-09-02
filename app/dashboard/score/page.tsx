import { getCurrentCustomerContext } from "@/lib/dashboardData";

const SUBSCORE_LABELS: { key: string; label: string }[] = [
  { key: "identity_score", label: "Identity" },
  { key: "knowledge_score", label: "Knowledge" },
  { key: "authority_score", label: "Authority" },
  { key: "location_score", label: "Location" },
  { key: "machine_readability_score", label: "Machine Readability" },
];

export default async function ScorePage() {
  const ctx = await getCurrentCustomerContext();
  const score = ctx?.score;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">AI Presence Score</h1>
      <p className="text-medium-gray mb-10 max-w-[520px]">
        A snapshot of how clearly AI-assisted discovery systems can currently
        understand your business.
      </p>

      {!score ? (
        <div className="glass rounded-[28px] p-10 text-medium-gray">
          Your score will appear here once the AI Presence Audit stage of
          your analysis is complete.
        </div>
      ) : (
        <div className="glass rounded-[28px] p-10">
          <div className="flex items-baseline gap-4 mb-10">
            <span className="font-mono text-6xl font-semibold">{score.overall_score}</span>
            <span className="text-medium-gray text-sm">OUT OF 100</span>
          </div>
          <div className="flex flex-col gap-6">
            {SUBSCORE_LABELS.map(({ key, label }) => {
              const val = (score as any)[key] as number | null;
              return (
                <div key={key} className="flex items-center gap-5">
                  <span className="w-[170px] shrink-0 text-[14.5px] text-[#d4d4d8]">
                    {label}
                  </span>
                  <div className="flex-1 h-1.5 rounded-md bg-white/[0.08] overflow-hidden">
                    <div
                      className="h-full bg-white rounded-md"
                      style={{ width: `${val ?? 0}%` }}
                    />
                  </div>
                  <span className="font-mono text-sm text-medium-gray w-8 text-right">
                    {val ?? "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
