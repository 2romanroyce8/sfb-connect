import { getCurrentCustomerContext } from "@/lib/dashboardData";

const SEVERITY_STYLE: Record<string, string> = {
  info: "bg-white/10 text-white",
  minor: "bg-yellow-400/15 text-yellow-300",
  moderate: "bg-orange-400/15 text-orange-300",
  critical: "bg-red-400/15 text-red-300",
};

export default async function FindingsPage() {
  const ctx = await getCurrentCustomerContext();
  const findings = ctx?.findings || [];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Findings</h1>
      <p className="text-medium-gray mb-10 max-w-[560px]">
        Issues identified during your AI Presence Audit, ranked by how much
        they affect machine understanding of your business.
      </p>

      {findings.length === 0 ? (
        <div className="glass rounded-[28px] p-10 text-medium-gray">
          No findings recorded yet. Findings appear here as your audit
          progresses.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {findings.map((f: any) => (
            <div key={f.id} className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`text-[11px] font-mono uppercase px-2.5 py-1 rounded-full ${
                    SEVERITY_STYLE[f.severity] || SEVERITY_STYLE.info
                  }`}
                >
                  {f.severity}
                </span>
                {f.resolved && (
                  <span className="text-[11px] font-mono uppercase text-medium-gray">
                    Resolved
                  </span>
                )}
              </div>
              <p className="text-[15px] mb-2">{f.finding}</p>
              {f.recommendation && (
                <p className="text-sm text-medium-gray">→ {f.recommendation}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
