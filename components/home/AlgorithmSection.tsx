"use client";

import { useEffect, useRef, useState } from "react";
import Reveal from "@/components/ui/Reveal";
import SectionLabel from "@/components/ui/SectionLabel";
import EditorialHeading from "@/components/ui/EditorialHeading";
import OrbitalNode from "@/components/ui/OrbitalNode";
import AmbientOrb from "@/components/ui/AmbientOrb";

const SIGNALS = [
  "Location",
  "Service",
  "Intent",
  "Relevance",
  "Business Information",
  "Freshness",
  "Consistency",
  "Availability",
  "Specialization",
];

export default function AlgorithmSection() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<{ x: number; y: number }[] | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function layout() {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile || !mapRef.current) return;
      const cx = mapRef.current.clientWidth / 2;
      const cy = mapRef.current.clientHeight / 2;
      const radius = 250;
      setPositions(
        SIGNALS.map((_, i) => {
          const angle = (i / SIGNALS.length) * 2 * Math.PI - Math.PI / 2;
          return {
            x: cx + radius * Math.cos(angle),
            y: cy + radius * Math.sin(angle),
          };
        })
      );
    }
    layout();
    window.addEventListener("resize", layout);
    return () => window.removeEventListener("resize", layout);
  }, []);

  return (
    <section className="py-24 md:py-32 section-band" id="algorithm">
      <div className="max-w-[1200px] mx-auto px-8">
        <Reveal>
          <SectionLabel>Why This Matters</SectionLabel>
          <EditorialHeading size="md" className="mb-16 max-w-2xl">
            The same internet does not look the same to everyone.
          </EditorialHeading>
        </Reveal>
        <Reveal>
          <p className="max-w-[700px] text-lg leading-relaxed text-[#c7c7cc] mb-16">
            Modern recommendation systems evaluate context. Location, intent,
            relevance, preferences, history and available information can
            influence what gets surfaced. AI business discovery can behave
            similarly: the ideal recommendation can change depending on who
            is asking and what they actually need.
          </p>
        </Reveal>
        <Reveal>
          {!isMobile ? (
            <div
              ref={mapRef}
              className="relative flex items-center justify-center min-h-[520px]"
            >
              <AmbientOrb color="cyan" size={200} className="left-[20%] top-[10%]" />
              <AmbientOrb color="violet" size={220} className="right-[15%] top-[15%]" />
              <div className="absolute rounded-full border border-dashed border-white/10 w-[340px] h-[340px]" />
              <div className="absolute rounded-full border border-dashed border-white/10 w-[520px] h-[520px]" />
              <div className="glass-edge w-[130px] h-[130px] rounded-full flex items-center justify-center font-extrabold text-xl z-10">
                AI
              </div>
              {positions &&
                SIGNALS.map((s, i) => (
                  <OrbitalNode
                    key={s}
                    label={s}
                    x={positions[i].x}
                    y={positions[i].y}
                    delay={i * 0.4}
                  />
                ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5 justify-center py-10">
              {SIGNALS.map((s) => (
                <div
                  key={s}
                  className="font-mono text-[12.5px] glass-edge px-4 py-2 rounded-full"
                >
                  {s}
                </div>
              ))}
            </div>
          )}
        </Reveal>
        <Reveal>
          <div className="mt-14 text-center font-mono text-sm text-medium-gray tracking-wide">
            → RECOMMENDED BUSINESSES
          </div>
        </Reveal>
      </div>
    </section>
  );
}
