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
const TICK_COUNT = 64;
const ACCENT_ANGLES = [78, 90, 102, 114, 126, 138, 150, 162, 174, 186, 198, 210];

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

  return (
    <div
      ref={ref}
      className="grid md:grid-cols-[440px_1fr] gap-12 md:gap-16 items-center"
    >
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
              style={{ transform: `rotate(${angle}deg) translateY(-191px)` }}
            />
          );
        })}
        {ACCENT_ANGLES.map((angle, i) => (
          <div
            key={`accent-${i}`}
            className="score-orbit__tick score-orbit__tick--accent"
            style={{ transform: `rotate(${angle}deg) translateY(-191px)` }}
          />
        ))}

        <svg
          className="absolute inset-0"
          width="420"
          height="420"
          viewBox="0 0 420 420"
        >
          <path
            id="scoreArcPath"
            d="M 100 190 A 150 150 0 0 1 320 190"
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
