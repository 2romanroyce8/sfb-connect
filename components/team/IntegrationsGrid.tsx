import Link from "next/link";
import type { Integration } from "@/lib/integrations/registry";

export type GridCard = {
  key: string;
  name: string;
  logo: string | null;
  status: Integration["status"];
  connectKind: Integration["connectKind"];
  connected: boolean;
  configured: boolean;
  accountLabel: string | null;
};

/** Live-or-connected first, then needs-setup, parked last; stable within groups. */
export function sortCards(cards: GridCard[]): GridCard[] {
  const rank = (c: GridCard) => (c.connected ? 0 : c.status === "live" ? 1 : c.status === "needs_setup" ? 2 : 3);
  return [...cards].sort((a, b) => rank(a) - rank(b));
}

// Slight, deterministic tile variation so the grid feels organic (reference: Raycast) while staying aligned.
const TILE_VARIANTS = [
  "radial-gradient(120% 120% at 30% 20%, rgba(255,255,255,0.14), rgba(255,255,255,0.03) 60%)",
  "radial-gradient(120% 120% at 70% 30%, rgba(255,255,255,0.11), rgba(255,255,255,0.02) 65%)",
  "radial-gradient(130% 130% at 50% 0%, rgba(255,255,255,0.16), rgba(255,255,255,0.03) 55%)",
  "radial-gradient(110% 110% at 20% 80%, rgba(255,255,255,0.10), rgba(255,255,255,0.025) 60%)",
];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function Pill({ card }: { card: GridCard }) {
  const live = card.connected || card.status === "live";
  const label = card.connectKind === "system" ? (live ? "Configured" : "Not configured") : card.connected ? "Connected" : card.status === "live" ? "Live" : card.status === "planned" ? "Parked" : "Needs setup";
  return (
    <span className="inline-flex items-center gap-1.5 h-[22px] px-2.5 rounded-full text-[11px] font-medium" style={{ background: live ? "rgba(48,209,88,0.12)" : "rgba(255,255,255,0.06)", color: live ? "#30D158" : "#8E8E93", border: `1px solid ${live ? "rgba(48,209,88,0.25)" : "rgba(255,255,255,0.08)"}` }}>
      <span className="w-[6px] h-[6px] rounded-full" style={{ background: live ? "#30D158" : "#6E6E73" }} />{label}
    </span>
  );
}

function Action({ card }: { card: GridCard }) {
  const manage = `/team/integrations?manage=${card.key}`;
  const primary = "inline-flex items-center justify-center h-[34px] px-4 rounded-full text-[12.5px] font-semibold bg-white text-black hover:opacity-90 transition-opacity";
  const ghost = "inline-flex items-center justify-center h-[34px] px-4 rounded-full text-[12.5px] font-medium text-[#F5F5F7] hover:bg-white/[0.06] transition-colors";
  const ghostStyle = { border: "1px solid rgba(255,255,255,0.14)" };
  if (card.connectKind === "system") return <span className="text-[11.5px] text-[#6E6E73]">SFB backend service</span>;
  if (card.status === "planned") return <span className="text-[11.5px] text-[#6E6E73]">Offered on request</span>;
  if (card.connected) return <Link href={manage} className={ghost} style={ghostStyle}>Manage</Link>;
  if (card.connectKind === "google_calendar") return <a href="/api/team/integrations/google/connect" className={primary}>Connect</a>;
  if (card.connectKind === "oauth") return card.configured ? <a href={`/api/team/integrations/${card.key}/connect`} className={primary}>Connect</a> : <Link href={manage} className={ghost} style={ghostStyle}>Set up</Link>;
  return <Link href={manage} className={ghost} style={ghostStyle}>Manage</Link>;
}

/** Icon-first card grid: every integration's state and action at a glance, no scrolling. */
export default function IntegrationsGrid({ cards, selected }: { cards: GridCard[]; selected?: string | null }) {
  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
      {sortCards(cards).map((c) => {
        const v = TILE_VARIANTS[hash(c.key) % TILE_VARIANTS.length];
        const active = selected === c.key;
        return (
          <div key={c.key} className="rounded-[20px] p-4 flex flex-col items-center text-center gap-3 transition-shadow" style={{ background: "#0B0B0C", border: `1px solid ${active ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.06)"}`, boxShadow: active ? "0 0 0 1px rgba(255,255,255,0.08), 0 20px 50px rgba(0,0,0,0.45)" : "0 10px 30px rgba(0,0,0,0.35)", opacity: c.status === "planned" ? 0.55 : 1 }}>
            <Link href={`/team/integrations?manage=${c.key}`} className="block w-[84px] h-[84px] rounded-[22px] flex items-center justify-center" style={{ backgroundImage: v, backgroundColor: "#141416", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 12px 30px rgba(0,0,0,0.4)" }} aria-label={`${c.name} details`}>
              {c.logo ? <img src={c.logo} alt={c.name} className="w-[44px] h-[44px] object-contain" style={{ filter: c.status === "planned" ? "grayscale(1)" : undefined }} /> : <span className="text-[13px] text-[#6E6E73]">{c.name}</span>}
            </Link>
            <div className="text-[13.5px] font-semibold text-[#F5F5F7] leading-tight">{c.name}</div>
            <Pill card={c} />
            <Action card={c} />
          </div>
        );
      })}
    </div>
  );
}
