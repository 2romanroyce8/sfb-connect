import type { FeedItem } from "@/lib/customerPortal/agentFeed";

/** The agent at work: one row per real action, human-approved badge, credit receipt. Honest empty state. */
export default function AgentFeed({ items, title = "Your agent's actions" }: { items: FeedItem[]; title?: string }) {
  return (
    <section className="mb-10" data-tour="agent-feed">
      <h2 className="text-[13px] font-semibold text-neutral-900 mb-3">{title}</h2>
      {items.length === 0 ? (
        <div className="border border-neutral-200 rounded-xl p-6 text-[13px] text-neutral-500">Your agent&apos;s first actions will appear here — each one with what it did, whether you approved it, and what it cost.</div>
      ) : (
        <div className="border border-neutral-200 rounded-xl divide-y divide-neutral-100">
          {items.map((a) => (
            <div key={a.id} className="p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium text-neutral-900">{a.title}</div>
                {a.detail && <div className="text-[12.5px] text-neutral-500 mt-0.5">{a.detail}</div>}
                <div className="text-[11px] text-neutral-400 mt-1">{new Date(a.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {a.approved && <span className="text-[10.5px] font-medium rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">Human-approved</span>}
                {a.status === "waiting" && <span className="text-[10.5px] font-medium rounded-full px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200">Needs you</span>}
                {a.status === "failed" && <span className="text-[10.5px] font-medium rounded-full px-2 py-0.5 bg-red-50 text-red-700 border border-red-200">Failed</span>}
                {a.credits != null && <span className="text-[11px] font-mono text-neutral-600">{a.credits === 0 ? "0 credits" : `−${a.credits} cr`}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
