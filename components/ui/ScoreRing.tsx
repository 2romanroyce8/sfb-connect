"use client";

import { useEffect, useRef, useState } from "react";

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
      className="grid md:grid-cols-[340px_1fr] gap-12 md:gap-16 items-center"
    >
      <div className="flex justify-center">
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
      <div>
        <div className="flex flex-col gap-6">
          {SUBSCORES.map((s) => (
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
