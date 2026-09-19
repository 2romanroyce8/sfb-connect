import type { ActivityItem } from "@/lib/customerPortal/overview";

const STATUS_STYLE: Record<ActivityItem["status"], string> = {
  Completed: "bg-neutral-100 text-neutral-600",
  Running: "bg-amber-50 text-amber-700 border border-amber-200",
  Waiting: "bg-neutral-50 text-neutral-500 border border-neutral-200",
  "Needs You": "bg-red-50 text-red-700 border border-red-200",
};

export default function OverviewActivity({ activity }: { activity: ActivityItem[] }) {
  return (
    <section className="mb-10">
      <h2 className="text-[13px] font-semibold text-neutral-900 mb-3">Recent SFB Activity</h2>
      {activity.length === 0 ? (
        <div className="border border-neutral-200 rounded-xl p-6 text-[13px] text-neutral-500">
          No activity recorded yet -- this fills in as SFB starts working on your account.
        </div>
      ) : (
        <div className="border border-neutral-200 rounded-xl divide-y divide-neutral-100">
          {activity.map((a) => (
            <div key={a.id} className="p-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-[13px] font-medium text-neutral-900">{a.title}</div>
                {a.detail && <div className="text-[12px] text-neutral-500 mt-0.5">{a.detail}</div>}
                <div className="text-[11px] text-neutral-400 mt-1">
                  {new Date(a.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </div>
              </div>
              <span className={`shrink-0 text-[10.5px] font-medium rounded-full px-2 py-0.5 ${STATUS_STYLE[a.status]}`}>{a.status}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
