import { Radar, Crosshair, Star, Gauge, MessageSquare } from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";
import NeonCard from "@/components/ui/NeonCard";
import { fetchAgentModules } from "@/lib/agentProgram/modules";
import { SCOPE, scopeAction } from "@/lib/analyzer/scope";
import type { CheckKey } from "@/lib/analyzer/types";

// THE SCOPE — the five dimensions the 7-day analyzer scans (Roman addendum,
// 2026-10-10; replaces the four presence-only pillars). Same glowing cards;
// each card: what we scan + the one-line "your agent does X" that follows the
// capability registry status.
const STYLE: Record<CheckKey, { icon: typeof Radar; borderGradient: string; glowGradient: string }> = {
  presence: { icon: Radar, borderGradient: "linear-gradient(135deg, var(--hx-ff4e78) 0%, var(--hx-ff55a7) 25%, var(--hx-ff9352) 62%, var(--hx-ffd35a) 100%)", glowGradient: "linear-gradient(135deg, rgba(255,78,120,0.65), rgba(255,147,82,0.5), rgba(255,211,90,0.35))" },
  outbound: { icon: Crosshair, borderGradient: "linear-gradient(135deg, var(--hx-ff8fa0) 0%, var(--hx-e9f5ff) 22%, var(--hx-55d8ff) 55%, var(--hx-00c7f4) 100%)", glowGradient: "linear-gradient(135deg, rgba(255,143,160,0.35), rgba(90,216,255,0.55), rgba(0,199,244,0.5))" },
  reviews: { icon: Star, borderGradient: "linear-gradient(135deg, var(--hx-ffd35a) 0%, var(--hx-ffb347) 40%, var(--hx-ff7a59) 100%)", glowGradient: "linear-gradient(135deg, rgba(255,211,90,0.55), rgba(255,179,71,0.5), rgba(255,122,89,0.4))" },
  website: { icon: Gauge, borderGradient: "linear-gradient(135deg, var(--hx-665cff) 0%, var(--hx-7859ff) 35%, var(--hx-b965ff) 70%, var(--hx-ff8ddc) 100%)", glowGradient: "linear-gradient(135deg, rgba(102,92,255,0.55), rgba(185,101,255,0.55), rgba(255,141,220,0.4))" },
  chat: { icon: MessageSquare, borderGradient: "linear-gradient(135deg, var(--hx-34d399) 0%, var(--hx-22d3ee) 55%, var(--hx-a7f3d0) 100%)", glowGradient: "linear-gradient(135deg, rgba(52,211,153,0.55), rgba(34,211,238,0.5), rgba(167,243,208,0.35))" },
};

export default async function AnalyzeSection() {
  const modules = await fetchAgentModules();
  return (
    <section className="py-24 md:py-32 section-band" id="analyze">
      <div className="max-w-[1200px] mx-auto px-8">
        <Reveal>
          <SectionHead label="The Scope" title="What We Analyze" subtitle={<>Five checks on public data in about 30 seconds — the same five days your agent would work first.</>} />
        </Reveal>
        <Reveal>
          <div className="neon-cards-wrap" data-theme-lock="dark">
            {SCOPE.map((s) => {
              const a = scopeAction(s.check, modules);
              return <NeonCard key={s.check} icon={STYLE[s.check].icon} title={s.title} description={s.scans} action={a.line} actionLive={a.live} borderGradient={STYLE[s.check].borderGradient} glowGradient={STYLE[s.check].glowGradient} />;
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
