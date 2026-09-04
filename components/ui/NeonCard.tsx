import type { LucideIcon } from "lucide-react";

export default function NeonCard({
  icon: Icon,
  title,
  description,
  borderGradient,
  glowGradient,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  borderGradient: string;
  glowGradient: string;
}) {
  return (
    <div
      className="neon-card"
      style={
        {
          "--neon-border-gradient": borderGradient,
          "--neon-glow-gradient": glowGradient,
        } as React.CSSProperties
      }
    >
      <div className="neon-card__inner" />
      <div className="neon-card__content">
        <Icon className="neon-card__logo" strokeWidth={1.75} />
        <div className="neon-card__title">{title}</div>
        <div className="neon-card__description">{description}</div>
      </div>
    </div>
  );
}
