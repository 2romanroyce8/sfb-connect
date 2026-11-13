import { branding } from "./branding";

export function OrbMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`orb orb--${size}`} src={branding.mark} alt="" width={1080} height={1080} />
  );
}

export function Brand({variant="executive"}:{variant?:"executive"|"staff"}={}) {
  return (
    <div className="brand">
      <OrbMark size="md" />
      <div>
        <b>{variant==="staff"?branding.title:"SFB Team"}</b>
        <span>{variant==="staff"?branding.subtitle:"Executive headquarters"}</span>
      </div>
    </div>
  );
}
