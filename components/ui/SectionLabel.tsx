export default function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-xs tracking-[0.28em] uppercase text-medium-gray mb-6 block">
      {children}
    </span>
  );
}
