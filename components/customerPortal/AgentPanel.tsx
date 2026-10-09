import { STATUS_LABEL, STATUS_COLOR } from "@/lib/agentProgram/config";
import { roadmapPosition, type AgentModule } from "@/lib/agentProgram/modules";

type Receipt = { id: string; type: string; amount: number; balance_after: number; description: string | null; created_at: string };
type Overseer = { name: string; role: string } | null;

// Customer dashboard: what the business's agent can do today, what is coming
// and where it sits on the roadmap, the credit balance with per-task
// receipts, and the human who oversees the agent. Light theme (portal).
export default function AgentPanel({ modules, creditBalance, receipts, overseer }: { modules: AgentModule[]; creditBalance: number; receipts: Receipt[]; overseer: Overseer }) {
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-semibold text-neutral-900">Your SFB Agent</h2>
        <span className="text-[11.5px] text-neutral-400">{modules.filter((m) => m.status === "live").length} of {modules.length} modules live</span>
      </div>
      <div className="border border-neutral-200 rounded-xl overflow-hidden">
        <ul className="divide-y divide-neutral-100">
          {modules.map((m) => {
            const locked = m.status !== "live";
            const pos = roadmapPosition(modules, m.key);
            return (
              <li key={m.key} className={`p-4 flex items-start justify-between gap-4 ${locked ? "bg-neutral-50/60" : ""}`}>
                <div className={locked ? "opacity-70" : ""}>
                  <div className="text-[13px] font-medium text-neutral-900">{m.name}</div>
                  <div className="text-[12px] text-neutral-500 mt-0.5">{m.description}</div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium rounded-full px-2 py-0.5 border" style={{ color: locked ? "#525252" : "#047857", background: locked ? "#f5f5f5" : "#ecfdf5", borderColor: locked ? "#e5e5e5" : "#a7f3d0" }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLOR[m.status] }} />
                    {STATUS_LABEL[m.status]}
                  </span>
                  {locked && pos && <div className="text-[10.5px] text-neutral-400 mt-1">{pos === 1 ? "Next to unlock" : `#${pos} on the roadmap`}</div>}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-100 border-t border-neutral-100">
          <div className="p-4">
            <div className="text-[11px] uppercase tracking-wide text-neutral-400 mb-1">Credit balance</div>
            <div className="text-[22px] font-semibold text-neutral-900 leading-none">{creditBalance}</div>
            <div className="mt-3 text-[11px] uppercase tracking-wide text-neutral-400 mb-1.5">Recent receipts</div>
            {receipts.length === 0 ? (
              <div className="text-[12px] text-neutral-400">No credit activity yet. Every task your agent completes will show here with its cost.</div>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {receipts.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="text-neutral-700 truncate">{r.description || r.type.toLowerCase()}</span>
                    <span className="shrink-0 tabular-nums text-neutral-500">{r.amount > 0 ? "+" : ""}{r.amount} · {fmt(r.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="p-4">
            <div className="text-[11px] uppercase tracking-wide text-neutral-400 mb-1">Your human overseer</div>
            {overseer ? (
              <>
                <div className="text-[14px] font-medium text-neutral-900">{overseer.name}</div>
                <div className="text-[12px] text-neutral-500">{overseer.role}</div>
              </>
            ) : (
              <div className="text-[12.5px] text-neutral-600">Assigned during onboarding. Until then, the SFB team reviews your agent&apos;s work.</div>
            )}
            <p className="mt-3 text-[11.5px] text-neutral-400 leading-relaxed">Nothing customer-facing ships without human approval, and every report is human-signed.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
