import { STATUS_COLOR, STATUS_LABEL, type ModuleStatus } from "@/lib/agentProgram/config";

export default function StatusBadge({ status, size = "sm" }: { status: ModuleStatus; size?: "sm" | "xs" }) {
  const c = STATUS_COLOR[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-[0.08em] ${size === "xs" ? "text-[9.5px] px-2 py-[3px]" : "text-[10.5px] px-2.5 py-1"}`}
      style={{ color: c, background: `${c}1f`, border: `1px solid ${c}55` }}
    >
      <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: c }} />
      {STATUS_LABEL[status]}
    </span>
  );
}
