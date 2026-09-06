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
      style={{ height: 172, background: "#121212", border: "1px solid rgba(255,255,255,0.05)", padding: 22 }}
    >
      <Icon size={22} className="text-[#F5F5F7]" strokeWidth={1.6} />
      <div>
        <div className="text-[14px] text-[#D0D0D0]">{title}</div>
        <div className="text-[30px] font-semibold text-[#F5F5F7] mt-1 leading-none">{value}</div>
        {context && <div className="text-[12.5px] text-[#9B9B9B] mt-2">{context}</div>}
      </div>
    </div>
  );
}
