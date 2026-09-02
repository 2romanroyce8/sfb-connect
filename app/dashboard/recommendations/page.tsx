import { getCurrentCustomerContext } from "@/lib/dashboardData";

const PRIORITY_STYLE: Record<string, string> = {
  low: "bg-white/10 text-white",
  medium: "bg-yellow-400/15 text-yellow-300",
  high: "bg-red-400/15 text-red-300",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  done: "Done",
};

export default async function RecommendationsPage() {
  const ctx = await getCurrentCustomerContext();
  const recs = ctx?.recommendations || [];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Recommendations</h1>
      <p className="text-medium-gray mb-10 max-w-[560px]">
        Prioritized actions SFB Connect has identified to strengthen your AI
        Presence.
      </p>

      {recs.length === 0 ? (
        <div className="glass rounded-[28px] p-10 text-medium-gray">
          Recommendations will appear here once your Knowledge Optimization
          stage begins.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {recs.map((r: any) => (
            <div key={r.id} className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`text-[11px] font-mono uppercase px-2.5 py-1 rounded-full ${
                    PRIORITY_STYLE[r.priority] || PRIORITY_STYLE.medium
                  }`}
                >
                  {r.priority} priority
                </span>
                <span className="text-[11px] font-mono uppercase text-medium-gray">
                  {STATUS_LABEL[r.status] || r.status}
                </span>
              </div>
              <div className="font-semibold mb-1.5">{r.title}</div>
              {r.description && (
                <p className="text-sm text-medium-gray">{r.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
