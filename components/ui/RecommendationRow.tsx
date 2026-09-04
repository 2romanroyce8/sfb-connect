export default function RecommendationRow({
  rank,
  name,
  badge,
  highlight,
}: {
  rank: string;
  name: string;
  badge?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-colors ${
        highlight
          ? "bg-white/[0.06] border border-white/30 shadow-[0_0_40px_rgba(70,199,255,0.08)]"
          : "bg-white/[0.03] border border-transparent hover:bg-white/[0.06]"
      }`}
    >
      <span className="font-mono text-sm text-medium-gray w-7">{rank}</span>
      <span className="text-[15px] font-medium flex-1">{name}</span>
      {badge && (
        <span className="font-mono text-[11px] text-black bg-white px-2.5 py-1 rounded-full font-semibold">
          {badge}
        </span>
      )}
    </div>
  );
}
