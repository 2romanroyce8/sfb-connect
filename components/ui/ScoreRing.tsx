"use client";

import { useEffect, useRef, useState } from "react";
import MetricBar from "@/components/ui/MetricBar";
import AmbientOrb from "@/components/ui/AmbientOrb";

const SUBSCORES = [
  { name: "Identity", val: 92 },
  { name: "Knowledge", val: 58 },
  { name: "Authority", val: 71 },
  { name: "Location", val: 88 },
  { name: "Machine Readability", val: 49 },
];

const TARGET = 64;
const RADIUS = 118;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ScoreRing() {
  const ref = useRef<HTMLDivElement>(null);
  const [animated, setAnimated] = useState(false);
  const [display, setDisplay] = useState(0);

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
            if (cur >= TARGET) clearInterval(interval);
          }, 18);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [animated]);

  const offset = animated
    ? CIRCUMFERENCE - (TARGET / 100) * CIRCUMFERENCE
    : CIRCUMFERENCE;

  return (
    <div
      ref={ref}
      className="glass-edge relative overflow-hidden rounded-[36px] p-10 md:p-14 grid md:grid-cols-[340px_1fr] gap-12 md:gap-16 items-center"
    >
      <AmbientOrb color="cyan" size={280} className="-bottom-24 -left-16" />
      <AmbientOrb color="violet" size={220} className="-top-16 -right-10" />

      <div className="relative flex justify-center z-10">
        <div className="relative w-[280px] h-[280px]">
          <svg width="280" height="280" viewBox="0 0 280 280">
            <circle
              cx="140"
              cy="140"
              r={RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="16"
            />
            <circle
              cx="140"
              cy="140"
              r={RADIUS}
              fill="none"
              stroke="#ffffff"
              strokeWidth="16"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              transform="rotate(-90 140 140)"
              style={{ transition: "stroke-dashoffset 1.4s ease" }}
            />
          </svg>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <div className="font-mono text-[64px] font-semibold">
              {display}
            </div>
            <div className="text-[13px] text-medium-gray mt-1">
              OUT OF 100
            </div>
          </div>
        </div>
      </div>
      <div className="relative z-10">
        <div className="flex flex-col gap-6">
          {SUBSCORES.map((s) => (
            <MetricBar key={s.name} name={s.name} value={s.val} />
          ))}
        </div>
        <div className="mt-10">
          <a
            href="#pricing"
            className="bg-white text-black px-8 py-4 rounded-full text-base font-semibold inline-flex items-center gap-2 hover:scale-[1.03] transition-transform"
          >
            Improve My Score →
          </a>
        </div>
      </div>
    </div>
  );
}
