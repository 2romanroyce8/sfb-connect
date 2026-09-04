export default function ComparisonPanel({
  year,
  query,
  children,
  caption,
  emphasized,
}: {
  year: string;
  query: string;
  children: React.ReactNode;
  caption: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={
        emphasized
          ? "glass-edge rounded-[28px] p-10 shadow-[0_0_60px_rgba(70,199,255,0.06)]"
          : "rounded-[28px] p-10 border border-white/10 bg-white/[0.02]"
      }
    >
      <div className="font-mono text-[15px] text-medium-gray mb-5">{year}</div>
      <div className="text-xl font-semibold mb-7 leading-snug">{query}</div>
      {children}
      <div className="mt-4 text-[13px] text-medium-gray font-mono">{caption}</div>
    </div>
  );
}
