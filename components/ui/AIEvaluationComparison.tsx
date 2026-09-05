"use client";

import { useEffect, useRef, useState } from "react";

const SURFACE_SIGNALS = [
  "Logo design",
  "Instagram posts",
  "Follower count",
  "Website aesthetics",
  "Brand colors",
];

const DEEP_SIGNALS = [
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
      { threshold: 0.15, rootMargin: "-40px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative -mx-8 px-8 overflow-hidden">
      {/* Atmosphere */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: "-10%",
          bottom: "0%",
          width: "50%",
          height: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(255,85,55,0.16) 0%, rgba(255,70,45,0.07) 30%, rgba(0,0,0,0) 72%)",
          filter: "blur(50px)",
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          right: "-10%",
          bottom: "0%",
          width: "50%",
          height: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(255,85,55,0.13) 0%, rgba(255,70,45,0.06) 30%, rgba(0,0,0,0) 72%)",
          filter: "blur(52px)",
        }}
      />

      {/* Top copy */}
      <div
        className="relative z-[2] max-w-[880px] mx-auto text-center transition-all duration-700 ease-out"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(24px)",
        }}
      >
        <div className="text-[10px] font-semibold tracking-[0.22em] uppercase text-white/[0.42] mb-[18px]">
          How AI Actually Sees Your Business
        </div>
        <h2 className="text-[42px] sm:text-[56px] md:text-[72px] font-bold leading-[0.94] tracking-[-0.045em] text-white">
          AI evaluates more than
          <br />
          what{" "}
          <span className="font-serif-accent italic font-normal">
            looks impressive.
          </span>
        </h2>
        <p className="max-w-[690px] mx-auto mt-[22px] text-[15px] leading-relaxed text-white/[0.46]">
          Businesses often focus on what people can see. AI discovery systems
          evaluate identity, location, authority, structure, freshness and
          machine-readable information underneath the surface.
        </p>
      </div>

      {/* Framework visual: left metric / center beam / right metric */}
      <div className="relative z-[2] max-w-[1120px] mx-auto mt-16 md:mt-20">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-10 md:gap-6 items-center">
          {/* Left metric — quieter */}
          <div
            className="text-center md:text-left order-2 md:order-1 transition-all duration-700 ease-out"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(18px)",
              transitionDelay: "0.38s",
            }}
          >
            <div className="text-[56px] md:text-[76px] font-medium leading-[0.9] tracking-[-0.06em] text-[#f5f5f5]">
              35%
            </div>
            <div className="mt-[10px] text-[10px] font-semibold tracking-[0.18em] uppercase text-white/40">
              What Businesses Focus On
            </div>
            <div className="mt-2 text-[13px] text-white/[0.52]">
              Surface-level signals
            </div>
          </div>

          {/* Center beam */}
          <div
            className="relative order-1 md:order-2 mx-auto"
            style={{ width: "92px", height: "360px" }}
          >
            <div
              className="absolute pointer-events-none transition-transform duration-[1100ms] ease-out"
              style={{
                inset: "-24px -40px",
                background:
                  "linear-gradient(180deg, rgba(255,88,55,0) 0%, rgba(255,82,50,0.16) 14%, rgba(255,82,50,0.46) 48%, rgba(255,68,42,0.16) 80%, rgba(255,68,42,0) 100%)",
                filter: "blur(25px)",
                transform: visible ? "scaleY(1)" : "scaleY(0)",
                transformOrigin: "top",
                opacity: visible ? 1 : 0,
              }}
            />
            <div
              className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 transition-transform duration-[1100ms] ease-out"
              style={{
                width: "40px",
                background:
                  "linear-gradient(180deg, rgba(255,93,60,0.1) 0%, rgba(255,92,55,0.5) 20%, #FF5838 48%, rgba(255,75,45,0.4) 80%, rgba(255,75,45,0.03) 100%)",
                borderLeft: "1px solid rgba(255,170,140,0.18)",
                borderRight: "1px solid rgba(255,170,140,0.12)",
                boxShadow: "0 0 60px rgba(255,78,44,0.28)",
                transform: visible ? "scaleY(1)" : "scaleY(0)",
                transformOrigin: "top",
                opacity: visible ? 1 : 0,
                transitionDelay: "0.15s",
              }}
            />
            <div
              className="absolute left-1/2 top-0 w-2 h-2 rounded-full -translate-x-1/2 -translate-y-1/2"
              style={{ background: "#FF6A45", boxShadow: "0 0 16px rgba(255,106,69,0.7)" }}
            />
            <div className="absolute left-1/2 -bottom-10 -translate-x-1/2 flex flex-col items-center">
              <span className="w-px h-9 bg-white/[0.25]" />
              <span className="mt-3 text-[9px] font-semibold tracking-[0.16em] text-white/50 whitespace-nowrap">
                DEEPER SIGNALS
              </span>
            </div>
          </div>

          {/* Right metric — stronger */}
          <div
            className="text-center md:text-right order-3 transition-all duration-700 ease-out"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(18px)",
              transitionDelay: "0.5s",
            }}
          >
            <div className="text-[62px] md:text-[84px] font-medium leading-[0.9] tracking-[-0.06em] text-white">
              85%
            </div>
            <div
              className="mt-[10px] text-[10px] font-semibold tracking-[0.18em] uppercase"
              style={{ color: "#FF6A45" }}
            >
              What AI Actually Evaluates
            </div>
            <div className="mt-2 text-[13px] text-white/[0.62]">
              Structured discovery signals
            </div>
          </div>
        </div>
      </div>

      {/* Signal rows — pushed down, subtle */}
      <div className="relative z-[2] max-w-[1120px] mx-auto mt-24 md:mt-16 grid md:grid-cols-2 gap-10 md:gap-20">
        <div>
          <div className="text-[9px] font-semibold tracking-[0.16em] text-white/30 mb-3.5">
            SURFACE-LEVEL SIGNALS
          </div>
          <div className="flex flex-wrap gap-2">
            {SURFACE_SIGNALS.map((s) => (
              <span
                key={s}
                className="px-[11px] py-[7px] rounded-full text-[10px]"
                style={{
                  background: "rgba(255,255,255,0.015)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  color: "rgba(255,255,255,0.34)",
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div
            className="text-[9px] font-semibold tracking-[0.16em] mb-3.5"
            style={{ color: "rgba(255,105,70,0.72)" }}
          >
            STRUCTURED DISCOVERY SIGNALS
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-fit md:ml-auto">
            {DEEP_SIGNALS.map((s) => (
              <span
                key={s}
                className="px-[11px] py-[7px] rounded-full text-[10px] whitespace-nowrap"
                style={{
                  background: "rgba(255,90,55,0.018)",
                  border: "1px solid rgba(255,105,70,0.12)",
                  color: "rgba(255,255,255,0.54)",
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom statement */}
      <p className="relative z-[2] max-w-[820px] mx-auto mt-16 md:mt-[70px] text-center text-[19px] md:text-[21px] font-medium leading-[1.45] tracking-[-0.025em] text-white/[0.78]">
        Looking impressive can help a customer trust you. Being structured,
        consistent and understandable helps AI know when to recommend you.
      </p>
    </div>
  );
}
