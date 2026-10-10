import type { LucideIcon } from "lucide-react";

export default function NeonCard({
  icon: Icon,
  title,
  description,
  action,
  actionLive,
  borderGradient,
  glowGradient,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Optional one-line "your agent does X" — status-aware, supplied by the caller. */
  action?: string;
  actionLive?: boolean;
  borderGradient: string;
  glowGradient: string;
}) {
  return (
    <div
      className={`neon-card${action ? " neon-card--tall" : ""}`}
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
        {action && <div className="neon-card__action" style={{ color: actionLive ? "#30D158" : "rgba(255,255,255,0.55)" }}>→ {action}</div>}
      </div>
    </div>
  );
}
