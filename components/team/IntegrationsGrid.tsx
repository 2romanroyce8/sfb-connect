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

/** The one button each card gets. Parked integrations get none (no owner action). */
export function cardAction(c: GridCard): { label: "Connect" | "Manage" | "Configured" | "Set up"; href: string | null } | null {
  if (c.status === "planned") return null;
  if (c.connectKind === "system") return { label: "Configured", href: null };
  const manage = `/team/integrations?manage=${c.key}`;
  if (c.connected) return { label: "Manage", href: manage };
  if (c.connectKind === "google_calendar") return { label: "Connect", href: "/api/team/integrations/google/connect" };
  if (c.connectKind === "oauth") return c.configured ? { label: "Connect", href: `/api/team/integrations/${c.key}/connect` } : { label: "Set up", href: manage };
  return { label: "Manage", href: manage };
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
  const a = cardAction(card);
  const primary = "inline-flex items-center justify-center h-[34px] px-4 rounded-full text-[12.5px] font-semibold bg-white text-black hover:opacity-90 transition-opacity";
  const ghost = "inline-flex items-center justify-center h-[34px] px-4 rounded-full text-[12.5px] font-medium text-[#F5F5F7] hover:bg-white/[0.06] transition-colors";
  const ghostStyle = { border: "1px solid rgba(255,255,255,0.14)" };
  if (!a) return <span className="h-[34px]" aria-hidden />;
  if (a.label === "Configured") return <span className="inline-flex items-center justify-center h-[34px] px-4 rounded-full text-[12.5px] font-medium text-[#8E8E93]" style={ghostStyle} title="SFB's backend email sender — nothing to connect">Configured</span>;
  if (a.label === "Connect") return <a href={a.href!} className={primary}>Connect</a>;
  return <Link href={a.href!} className={ghost} style={ghostStyle}>{a.label}</Link>;
}

/** Icon-first card grid: every integration's state and action at a glance, no scrolling. This IS the page. */
export default function IntegrationsGrid({ cards, selected }: { cards: GridCard[]; selected?: string | null }) {
  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {sortCards(cards).map((c) => {
        const v = TILE_VARIANTS[hash(c.key) % TILE_VARIANTS.length];
        const active = selected === c.key;
        const parked = c.status === "planned";
        return (
          <div key={c.key} className="rounded-[20px] p-4 flex flex-col items-center text-center gap-3 transition-shadow" style={{ background: "#0B0B0C", border: `1px solid ${active ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.06)"}`, boxShadow: active ? "0 0 0 1px rgba(255,255,255,0.08), 0 20px 50px rgba(0,0,0,0.45)" : "0 10px 30px rgba(0,0,0,0.35)", opacity: parked ? 0.5 : 1 }}>
            <Link href={`/team/integrations?manage=${c.key}`} className="block w-[84px] h-[84px] rounded-[22px] flex items-center justify-center" style={{ backgroundImage: v, backgroundColor: "#141416", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 12px 30px rgba(0,0,0,0.4)" }} aria-label={`${c.name} details`}>
              {c.logo ? <img src={c.logo} alt={c.name} className="w-[44px] h-[44px] object-contain" style={{ filter: parked ? "grayscale(1)" : undefined }} /> : <span className="text-[13px] text-[#6E6E73]">{c.name}</span>}
            </Link>
            <div>
              <div className="text-[13.5px] font-semibold text-[#F5F5F7] leading-tight">{c.name}</div>
              {c.connectKind === "system" && <div className="mt-0.5 text-[11px] text-[#6E6E73]">SFB backend email sender</div>}
              {c.accountLabel && c.connectKind !== "system" && <div className="mt-0.5 text-[11px] text-[#6E6E73] truncate max-w-[180px]">{c.accountLabel}</div>}
            </div>
            <Pill card={c} />
            <Action card={c} />
          </div>
        );
      })}
    </div>
  );
}
