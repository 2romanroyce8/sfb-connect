"use client";

import { useEffect, useRef, useState } from "react";
import { Check, AlertCircle, ArrowUpRight } from "lucide-react";
import { useBusinessLookup } from "@/lib/businessLookupContext";

const DEMO_SUBSCORES = [
  { name: "Identity", val: 92 },
  { name: "Knowledge", val: 58 },
  { name: "Authority", val: 71 },
  { name: "Location", val: 88 },
  { name: "Machine Readability", val: 49 },
];
const DEMO_TARGET = 64;

const TICK_COUNT = 64;
const ACCENT_ANGLES = [78, 90, 102, 114, 126, 138, 150, 162, 174, 186, 198, 210];

export default function ScoreRing() {
  const { selectedBusiness, summary, openChatWithMessage } = useBusinessLookup();
  const ref = useRef<HTMLDivElement>(null);
  const [animated, setAnimated] = useState(false);
  const [display, setDisplay] = useState(0);

  const target = selectedBusiness ? selectedBusiness.scores.overall : DEMO_TARGET;
  const subscores = selectedBusiness
    ? [
        { name: "Identity", val: selectedBusiness.scores.identity * 5 },
        { name: "Knowledge", val: selectedBusiness.scores.knowledge * 5 },
        { name: "Authority", val: selectedBusiness.scores.authority * 5 },
        { name: "Location", val: selectedBusiness.scores.location * 5 },
        { name: "Machine Readability", val: selectedBusiness.scores.machineReadability * 5 },
      ]
    : DEMO_SUBSCORES;

  useEffect(() => {
    setAnimated(false);
    setDisplay(0);
  }, [target]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animated) {
          setAnimated(true);
          let cur = 0;
          const interval = setInterval(() => {
            cur++;
            setDisplay(cur);
            if (cur >= target) clearInterval(interval);
          }, 18);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [animated, target]);

  return (
    <div ref={ref}>
      {selectedBusiness && (
        <div className="flex items-center gap-3 mb-10 pb-8 border-b border-white/10">
          <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center text-[13px] font-bold shrink-0">
            {(selectedBusiness.business.name.value || "?").slice(0, 1)}
          </div>
          <div className="min-w-0">
            <div className="text-[16px] font-semibold text-white truncate">
              {selectedBusiness.business.name.value || "Unknown business"}
            </div>
            <div className="text-[12.5px] text-medium-gray truncate">
              {selectedBusiness.business.website.value}
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-[340px_1fr] gap-12 md:gap-16 items-center">
        <div className="score-orbit">
          <div className="score-orbit__halo" />
          <div className="score-orbit__glow" />
          <div className="score-orbit__hot-edge" />
          <div className="score-orbit__outer" />
          <div className="score-orbit__inner" />

          {Array.from({ length: TICK_COUNT }).map((_, i) => {
            const angle = i * (360 / TICK_COUNT) - 90;
            return (
              <div
                key={i}
                className="score-orbit__tick"
                style={{ transform: `rotate(${angle}deg) translateY(-127px)` }}
              />
            );
          })}
          {ACCENT_ANGLES.map((angle, i) => (
            <div
              key={`accent-${i}`}
              className="score-orbit__tick score-orbit__tick--accent"
              style={{ transform: `rotate(${angle}deg) translateY(-127px)` }}
            />
          ))}

          <svg
            className="absolute inset-0"
            width="280"
            height="280"
            viewBox="0 0 280 280"
          >
            <path
              id="scoreArcPath"
              d="M 67 127 A 100 100 0 0 1 213 127"
              fill="none"
            />
            <text className="score-orbit__arc-text" textAnchor="middle">
              <textPath href="#scoreArcPath" startOffset="50%">
                AI PRESENCE SCORE
              </textPath>
            </text>
          </svg>

          <div className="score-orbit__core" />
          <div className="score-orbit__number">{display}</div>
          <div className="score-orbit__of">OUT OF 100</div>
        </div>

        <div>
          <div className="flex flex-col gap-6">
            {subscores.map((s) => (
              <div key={s.name} className="flex items-center gap-5">
                <span className="w-[170px] shrink-0 text-[14.5px] text-[#d4d4d8]">
                  {s.name}
                </span>
                <div className="flex-1 h-1.5 rounded-md bg-white/[0.08] overflow-hidden">
                  <div
                    className="h-full bg-white rounded-md transition-[width] duration-[1200ms] ease-out"
                    style={{ width: animated ? `${s.val}%` : "0%" }}
                  />
                </div>
                <span className="font-mono text-sm text-medium-gray w-8 text-right">
                  {s.val}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-10">
            {selectedBusiness ? (
              <button
                onClick={() =>
                  openChatWithMessage(
                    "Based on my business analysis, what should I fix first to improve my AI Presence Score?"
                  )
                }
                className="bg-white text-black px-8 py-4 rounded-full text-base font-semibold inline-flex items-center gap-2 hover:scale-[1.03] transition-transform"
              >
                Improve My Score →
              </button>
            ) : (
              <a
                href="#pricing"
                className="bg-white text-black px-8 py-4 rounded-full text-base font-semibold inline-flex items-center gap-2 hover:scale-[1.03] transition-transform"
              >
                Improve My Score →
              </a>
            )}
          </div>
        </div>
      </div>

      {selectedBusiness && summary && (
        <div className="mt-14 pt-10 border-t border-white/10">
          <div className="text-[12px] font-mono uppercase tracking-[0.14em] text-medium-gray mb-4">
            SFB AI Presence Preview
          </div>
          <p className="text-[16px] md:text-[17px] leading-relaxed text-white/[0.85] max-w-[720px] mb-6">
            {summary.summary}
          </p>
          <p className="text-[14px] leading-relaxed text-medium-gray max-w-[720px] mb-8">
            {summary.whyScoreIsWhatItIs}
          </p>
          <div className="grid sm:grid-cols-2 gap-4 max-w-[720px]">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-medium-gray mb-3">
                What AI understands
              </div>
              <div className="flex flex-col gap-2">
                {summary.whatAIUnderstands.map((s) => (
                  <div key={s} className="flex items-start gap-2 text-[13px] text-white/75">
                    <Check size={13} className="text-[#30D158] mt-[2px] shrink-0" />
                    {s}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-medium-gray mb-3">
                What may be holding you back
              </div>
              <div className="flex flex-col gap-2">
                {summary.whatMayBeMissing.map((s) => (
                  <div key={s} className="flex items-start gap-2 text-[13px] text-white/75">
                    <AlertCircle size={13} className="text-[#FFD60A] mt-[2px] shrink-0" />
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10 max-w-[720px]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-medium-gray mb-3">
              Recommended next steps
            </div>
            <div className="flex flex-col gap-2">
              {summary.recommendedNextSteps.map((s) => (
                <div key={s} className="flex items-start gap-2 text-[13px] text-white/75">
                  <ArrowUpRight size={13} className="text-white mt-[2px] shrink-0" />
                  {s}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
