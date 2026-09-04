import { cn } from "@/lib/cn";

/**
 * Large editorial heading. Wrap the accent word(s) in <Accent> to render
 * them in Instrument Serif italic — the site's one recurring typographic
 * flourish, used sparingly (never whole paragraphs).
 */
export function Accent({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-serif-accent italic font-normal">{children}</span>
  );
}

export default function EditorialHeading({
  children,
  size = "lg",
  className,
}: {
  children: React.ReactNode;
  size?: "xl" | "lg" | "md";
  className?: string;
}) {
  const sizes = {
    xl: "text-[44px] sm:text-[64px] md:text-[88px] lg:text-[104px] leading-[0.98]",
    lg: "text-[34px] sm:text-[44px] md:text-[60px] lg:text-[72px] leading-[1.03]",
    md: "text-[28px] sm:text-[36px] md:text-[48px] leading-[1.06]",
  };

  return (
    <h2
      className={cn(
        "font-extrabold tracking-[-0.03em]",
        sizes[size],
        className
      )}
    >
      {children}
    </h2>
  );
}
