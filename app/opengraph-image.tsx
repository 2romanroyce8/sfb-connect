import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "SFB Connect — Be The Business AI Finds.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand-correct social card: pure black, white type, one restrained accent.
// Replaces the text-only share preview the site had (no og:image at all).
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#000000", color: "#F5F5F7", padding: 72, fontFamily: "Inter, Helvetica, Arial, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>
          SFB <span style={{ color: "#8E8E93", fontWeight: 600 }}>CONNECT</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 86, fontWeight: 800, letterSpacing: -4, lineHeight: 0.95 }}>Be the business AI finds.</div>
          <div style={{ fontSize: 32, color: "#A1A1A6", letterSpacing: -0.5 }}>Your customers are asking AI who to choose. Make sure it can find you.</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 24, color: "#8E8E93" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: 999, background: "#30D158" }} />
            AI Presence Optimization
          </div>
          <div>sfbconnect.com</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
