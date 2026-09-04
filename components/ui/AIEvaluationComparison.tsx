"use client";

import { useEffect, useRef, useState } from "react";

const THINK_SIGNALS = [
  "Logo design",
  "Instagram posts",
  "Follower count",
  "Website aesthetics",
  "Brand colors",
];

const EVALUATE_SIGNALS = [
  "Identity clarity",
  "Service area",
  "Structured data",
  "Schema",
  "Review authority",
  "NAP consistency",
  "Content freshness",
  "Knowledge depth",
  "Machine readability",
];

export default function AIEvaluationComparison() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.2, rootMargin: "-40px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`aec${visible ? " aec-visible" : ""} relative`}
    >
      <div className="aec-glow" />
      <div className="grid md:grid-cols-[0.88fr_1.12fr] gap-12 md:gap-20 items-end">
        {/* Left — what businesses focus on */}
        <div className="aec-rise">
          <div className="aec-eyebrow">What businesses focus on</div>
          <div className="aec-percent flex items-baseline gap-3">
            <span className="text-[56px] md:text-[72px] font-light tracking-[-0.055em] leading-[0.9] text-[#f1f1f1]">
              35%
            </span>
          </div>
          <div className="mt-3 text-[16px] leading-snug text-white/70 max-w-[220px]">
            surface-level signals
          </div>

          <div className="mt-8 flex flex-col items-start">
            <span className="w-2 h-2 rounded-full bg-white" />
            <span className="aec-guide aec-guide--white" />
          </div>

          <svg
            className="w-full max-w-[290px] h-auto mt-0"
            viewBox="0 0 290 190"
            fill="none"
          >
            <path
              d="M0 48 L170 48 L290 95 L290 190 L0 190 Z"
              className="aec-area aec-area--white"
            />
            <path
              d="M0 48 L170 48 L290 95"
              className="aec-line aec-line--white"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="6"
            />
          </svg>

          <div className="flex flex-wrap gap-[7px] mt-6 max-w-[330px]">
            {THINK_SIGNALS.map((s) => (
              <span key={s} className="aec-chip aec-chip--gray">
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Right — what AI actually evaluates */}
        <div className="aec-rise" style={{ transitionDelay: "0.1s" }}>
          <div className="aec-eyebrow aec-eyebrow--lime">
            What AI actually evaluates
          </div>
          <div className="aec-percent flex items-baseline gap-3" style={{ transitionDelay: "0.15s" }}>
            <span className="text-[62px] md:text-[76px] font-light tracking-[-0.055em] leading-[0.9] text-white">
              85%
            </span>
          </div>
          <div className="mt-3 text-[16px] leading-snug text-white/[0.82] max-w-[270px]">
            structured discovery signals
          </div>

          <div className="mt-8 flex flex-col items-start">
            <span className="w-2 h-2 rounded-full bg-[#c9ff3b] aec-dot-glow" />
            <span className="aec-guide aec-guide--lime" />
          </div>

          <svg
            className="w-full max-w-[430px] h-auto mt-0"
            viewBox="0 0 430 300"
            fill="none"
          >
            <path
              d="M0 70 L220 70 L430 145 L430 300 L0 300 Z"
              className="aec-area aec-area--lime"
              style={{ transitionDelay: "0.65s" }}
            />
            <path
              d="M0 70 L220 70 L430 145"
              className="aec-line aec-line--lime"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="6"
              style={{ transitionDelay: "0.3s" }}
            />
          </svg>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-[7px] mt-6 w-fit">
            {EVALUATE_SIGNALS.map((s) => (
              <span key={s} className="aec-chip aec-chip--lime">
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="aec-rise mt-8 text-[11px] tracking-wide text-white/30 font-mono">
        Illustrative emphasis, not a measured audit statistic.
      </div>
    </div>
  );
}
