"use client";

import { useEffect, useRef, useState } from "react";
import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";

const SIGNALS = [
  "Location",
  "Service",
  "Intent",
  "Relevance",
  "Business Information",
  "Authority",
  "Freshness",
  "Consistency",
  "Availability",
  "Specialization",
];

export default function AlgorithmSection() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<
    { x: number; y: number }[] | null
  >(null);
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
          <SectionHead
            label="Why This Matters"
            title="The same internet does not look the same to everyone."
          />
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
              className="relative flex items-center justify-center min-h-[480px]"
            >
              <div className="absolute rounded-full border border-dashed border-white/10 w-[340px] h-[340px]" />
              <div className="absolute rounded-full border border-dashed border-white/10 w-[520px] h-[520px]" />
              <div className="w-[120px] h-[120px] rounded-full bg-white text-black flex items-center justify-center font-extrabold text-xl z-10 shadow-[0_0_80px_rgba(255,255,255,0.25)]">
                AI
              </div>
              {positions &&
                SIGNALS.map((s, i) => (
                  <div
                    key={s}
                    className="absolute font-mono text-[12.5px] bg-white/[0.06] border border-white/10 backdrop-blur-md px-4 py-2 rounded-full whitespace-nowrap -translate-x-1/2 -translate-y-1/2"
                    style={{ left: positions[i].x, top: positions[i].y }}
                  >
                    {s}
                  </div>
                ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5 justify-center py-10">
              {SIGNALS.map((s) => (
                <div
                  key={s}
                  className="font-mono text-[12.5px] bg-white/[0.06] border border-white/10 px-4 py-2 rounded-full"
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
