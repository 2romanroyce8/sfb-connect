import type { LucideIcon } from "lucide-react";

export default function MetricCard({
  icon: Icon,
  title,
  value,
  context,
}: {
  icon: LucideIcon;
  title: string;
  value: string | number;
  context?: string;
}) {
  return (
    <div
      className="flex flex-col justify-between rounded-[8px]"
      style={{ height: 172, background: "var(--hx-121212)", border: "1px solid rgb(var(--w) / 0.05)", padding: 22 }}
    >
      <Icon size={22} className="text-[color:var(--hx-f5f5f7)]" strokeWidth={1.6} />
      <div>
        <div className="text-[14px] text-[color:var(--hx-d0d0d0)]">{title}</div>
        <div className="text-[30px] font-semibold text-[color:var(--hx-f5f5f7)] mt-1 leading-none">{value}</div>
        {context && <div className="text-[12.5px] text-[color:var(--hx-9b9b9b)] mt-2">{context}</div>}
      </div>
    </div>
  );
}
