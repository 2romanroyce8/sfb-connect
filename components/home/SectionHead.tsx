export default function SectionHead({
  label,
  title,
  description,
  center,
}: {
  label: string;
  title: React.ReactNode;
  description?: string;
  center?: boolean;
}) {
  return (
    <div
      className={`max-w-[760px] mb-16 ${center ? "mx-auto text-center" : ""}`}
    >
      <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-5 block">
        {label}
      </span>
      <h2 className="text-[32px] sm:text-[40px] md:text-[56px] font-extrabold tracking-[-0.025em] leading-[1.06]">
        {title}
      </h2>
      {description && (
        <p
          className={`mt-5 text-[17px] leading-relaxed text-[#a3a3a8] max-w-[640px] ${
            center ? "mx-auto" : ""
          }`}
        >
          {description}
        </p>
      )}
    </div>
  );
}
