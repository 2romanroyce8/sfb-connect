"use client";

import { useEffect, useRef, useState } from "react";

const GRAIN_URL =
  "url(data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.22'/%3E%3C/svg%3E)";

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
      { threshold: 0.12, rootMargin: "-40px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fade = (delay = 0, axis: "y" | "x" = "y", dist = 18) => ({
    opacity: visible ? 1 : 0,
    transform: visible
      ? "translate(0,0)"
      : axis === "y"
      ? `translateY(${dist}px)`
      : `translateX(${dist}px)`,
    transitionDelay: `${delay}s`,
  });

  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden"
      style={{ background: "#090A0C" }}
    >
      {/* Grain */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 20,
          opacity: 0.045,
          mixBlendMode: "screen",
          backgroundImage: GRAIN_URL,
        }}
      />

      {/* ============ DESKTOP / TABLET — absolute cinematic composition ============ */}
      <div className="hidden md:block relative" style={{ height: "860px" }}>
        {/* Atmosphere: clouds */}
        <div
          className="absolute pointer-events-none"
          style={{
            zIndex: 3,
            left: "-12%",
            bottom: "-2%",
            width: "65%",
            height: "52%",
            background:
              "radial-gradient(ellipse at 62% 46%, rgba(118,47,42,0.42) 0%, rgba(55,29,30,0.38) 25%, rgba(21,18,21,0.72) 58%, rgba(9,10,12,0) 76%)",
            filter: "blur(14px)",
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            zIndex: 4,
            left: "9%",
            bottom: "25%",
            width: "38%",
            height: "18%",
            background:
              "radial-gradient(ellipse at center, rgba(255,75,52,0.26) 0%, rgba(255,66,46,0.08) 38%, transparent 72%)",
            filter: "blur(14px)",
            transform: "rotate(12deg)",
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            zIndex: 3,
            right: "-13%",
            bottom: "-4%",
            width: "67%",
            height: "54%",
            background:
              "radial-gradient(ellipse at 36% 42%, rgba(104,44,42,0.40) 0%, rgba(49,27,29,0.40) 27%, rgba(18,17,20,0.78) 58%, rgba(9,10,12,0) 77%)",
            filter: "blur(15px)",
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            zIndex: 4,
            right: "9%",
            bottom: "27%",
            width: "38%",
            height: "18%",
            background:
              "radial-gradient(ellipse at center, rgba(255,72,50,0.24) 0%, rgba(255,65,45,0.07) 40%, transparent 72%)",
            filter: "blur(15px)",
            transform: "rotate(-11deg)",
          }}
        />

        {/* Mountains */}
        <svg
          className="absolute left-0 right-0 bottom-0 pointer-events-none"
          style={{ zIndex: 5, height: "360px", width: "100%" }}
          viewBox="0 0 1600 360"
          preserveAspectRatio="none"
        >
          <path
            d="M0 360 L0 260 L170 150 L310 245 L445 120 L610 260 L790 170 L950 260 L1120 125 L1290 240 L1440 160 L1600 265 L1600 360 Z"
            fill="#111216"
            opacity={0.72}
          />
          <path
            d="M0 360 L0 300 L210 230 L350 295 L510 185 L690 310 L835 245 L990 305 L1170 200 L1370 300 L1510 240 L1600 290 L1600 360 Z"
            fill="#090A0C"
          />
        </svg>

        {/* Beam ground glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            zIndex: 6,
            left: "50%",
            bottom: "37px",
            transform: "translateX(-50%)",
            width: "500px",
            height: "160px",
            background:
              "radial-gradient(ellipse at center, rgba(255,69,42,0.38) 0%, rgba(255,62,38,0.17) 28%, rgba(255,60,38,0.05) 50%, transparent 74%)",
            filter: "blur(16px)",
          }}
        />

        {/* Headline */}
        <div
          className="absolute left-1/2 -translate-x-1/2 text-center transition-all duration-700 ease-out"
          style={{ top: 0, width: "660px", maxWidth: "90vw", zIndex: 10, ...fade(0) }}
        >
          <h2
            className="font-bold text-[#f4f4f4]"
            style={{
              fontSize: "clamp(3.4rem, 5.2vw, 5.7rem)",
              lineHeight: 0.88,
              letterSpacing: "-0.055em",
            }}
          >
            AI evaluates more than
            <br />
            what{" "}
            <span className="font-serif-accent italic font-normal">
              looks impressive.
            </span>
          </h2>
          <p
            className="mx-auto mt-[15px]"
            style={{
              maxWidth: "520px",
              fontSize: "11px",
              lineHeight: 1.5,
              letterSpacing: "0.01em",
              color: "rgba(255,255,255,0.28)",
            }}
          >
            Businesses often focus on what people can see. AI evaluates the
            deeper signals that help it understand what your business is,
            where it operates, and when it should be recommended.
          </p>
        </div>

        {/* Center beam */}
        <div
          className="absolute left-1/2 -translate-x-1/2 transition-transform duration-[1200ms] ease-out"
          style={{
            top: "192px",
            width: "70px",
            height: "540px",
            zIndex: 7,
            transformOrigin: "top",
            transform: visible ? "translateX(-50%) scaleY(1)" : "translateX(-50%) scaleY(0)",
            opacity: visible ? 1 : 0,
          }}
        >
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              top: "-18px",
              width: "220px",
              height: "580px",
              background:
                "linear-gradient(180deg, rgba(255,74,43,0) 0%, rgba(255,77,43,0.05) 10%, rgba(255,77,43,0.22) 38%, rgba(255,66,38,0.34) 62%, rgba(255,52,30,0.08) 88%, rgba(255,52,30,0) 100%)",
              filter: "blur(28px)",
            }}
          />
          <div
            className="absolute left-1/2 -translate-x-1/2 top-0"
            style={{
              width: "52px",
              height: "100%",
              background:
                "linear-gradient(180deg, rgba(255,86,51,0.02) 0%, rgba(255,90,51,0.22) 16%, rgba(255,88,48,0.62) 45%, #FF5633 67%, rgba(255,72,40,0.34) 87%, rgba(255,62,35,0.02) 100%)",
              borderLeft: "1px solid rgba(255,135,100,0.10)",
              borderRight: "1px solid rgba(255,135,100,0.08)",
              boxShadow: "0 0 40px rgba(255,72,40,0.18)",
            }}
          />
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              top: "150px",
              width: "14px",
              height: "310px",
              background:
                "linear-gradient(180deg, rgba(255,153,125,0.05), rgba(255,107,72,0.62), rgba(255,79,47,0.92), rgba(255,77,45,0.15))",
              filter: "blur(6px)",
            }}
          />
          <div
            className="absolute left-1/2 top-0 bottom-0"
            style={{
              width: "1px",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.26), rgba(255,255,255,0.04))",
            }}
          />
        </div>

        {/* Left metric — lower, quieter */}
        <div
          className="absolute text-left transition-all duration-700 ease-out"
          style={{ left: "17%", top: "390px", width: "210px", zIndex: 11, ...fade(0.32, "x", -18) }}
        >
          <div
            style={{
              fontSize: "72px",
              fontWeight: 500,
              lineHeight: 0.84,
              letterSpacing: "-0.06em",
              color: "rgba(255,255,255,0.72)",
            }}
          >
            35%
          </div>
          <div
            className="mt-3"
            style={{
              fontSize: "8px",
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.28)",
            }}
          >
            What Businesses Focus On
          </div>
          <div className="mt-2" style={{ fontSize: "10px", color: "rgba(255,255,255,0.34)" }}>
            surface-level signals
          </div>
        </div>

        {/* Right metric — higher, stronger */}
        <div
          className="absolute text-left transition-all duration-700 ease-out"
          style={{ right: "15%", top: "305px", width: "220px", zIndex: 11, ...fade(0.4, "x", 18) }}
        >
          <div
            style={{
              fontSize: "76px",
              fontWeight: 600,
              lineHeight: 0.84,
              letterSpacing: "-0.06em",
              color: "#FFFFFF",
            }}
          >
            85%
          </div>
          <div
            className="mt-3"
            style={{
              fontSize: "8px",
              fontWeight: 700,
              letterSpacing: "0.17em",
              textTransform: "uppercase",
              color: "#FF6644",
            }}
          >
            What AI Actually Evaluates
          </div>
          <div className="mt-2" style={{ fontSize: "10px", color: "rgba(255,255,255,0.42)" }}>
            structured discovery signals
          </div>
        </div>

        {/* Tiny editorial signal labels */}
        <div
          className="absolute"
          style={{ left: "17%", bottom: "68px", width: "260px", zIndex: 11 }}
        >
          <div style={{ fontSize: "7px", letterSpacing: "0.18em", color: "rgba(255,255,255,0.24)" }}>
            VISIBLE SIGNALS
          </div>
          <div className="mt-[6px]" style={{ fontSize: "8px", letterSpacing: "0.05em", color: "rgba(255,255,255,0.22)" }}>
            LOGO · SOCIALS · WEBSITE DESIGN · FOLLOWERS
          </div>
        </div>
        <div
          className="absolute text-right"
          style={{ right: "14%", bottom: "68px", width: "320px", zIndex: 11 }}
        >
          <div style={{ fontSize: "7px", letterSpacing: "0.18em", color: "rgba(255,102,68,0.54)" }}>
            AI DISCOVERY SIGNALS
          </div>
          <div className="mt-[6px]" style={{ fontSize: "8px", letterSpacing: "0.05em", color: "rgba(255,255,255,0.32)" }}>
            IDENTITY · SCHEMA · LOCATION · AUTHORITY · KNOWLEDGE · FRESHNESS
          </div>
        </div>
      </div>

      {/* ============ MOBILE — simplified stacked version ============ */}
      <div className="md:hidden relative px-6 pt-16 pb-10">
        <div
          className="absolute pointer-events-none"
          style={{
            zIndex: 1,
            left: "-20%",
            bottom: "10%",
            width: "80%",
            height: "40%",
            background:
              "radial-gradient(ellipse at center, rgba(118,47,42,0.4) 0%, rgba(21,18,21,0.6) 55%, transparent 78%)",
            filter: "blur(16px)",
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            zIndex: 1,
            right: "-20%",
            bottom: "6%",
            width: "80%",
            height: "40%",
            background:
              "radial-gradient(ellipse at center, rgba(104,44,42,0.38) 0%, rgba(18,17,20,0.65) 55%, transparent 78%)",
            filter: "blur(17px)",
          }}
        />
        <svg
          className="absolute left-0 right-0 bottom-0 pointer-events-none"
          style={{ zIndex: 2, height: "200px", width: "100%" }}
          viewBox="0 0 1600 360"
          preserveAspectRatio="none"
        >
          <path
            d="M0 360 L0 260 L170 150 L310 245 L445 120 L610 260 L790 170 L950 260 L1120 125 L1290 240 L1440 160 L1600 265 L1600 360 Z"
            fill="#111216"
            opacity={0.72}
          />
          <path
            d="M0 360 L0 300 L210 230 L350 295 L510 185 L690 310 L835 245 L990 305 L1170 200 L1370 300 L1510 240 L1600 290 L1600 360 Z"
            fill="#090A0C"
          />
        </svg>

        <div className="relative z-10 text-center transition-all duration-700 ease-out" style={fade(0)}>
          <h2
            className="font-bold text-[#f4f4f4]"
            style={{ fontSize: "clamp(2.9rem, 12vw, 4.3rem)", lineHeight: 0.9, letterSpacing: "-0.05em" }}
          >
            AI evaluates more than what{" "}
            <span className="font-serif-accent italic font-normal">
              looks impressive.
            </span>
          </h2>
          <p className="mx-auto mt-4" style={{ maxWidth: "330px", fontSize: "10px", color: "rgba(255,255,255,0.3)", lineHeight: 1.5 }}>
            Businesses often focus on what people can see. AI evaluates the
            deeper signals underneath the surface.
          </p>
        </div>

        <div className="relative z-10 flex flex-col items-center mt-10">
          <div
            className="relative transition-transform duration-[1100ms] ease-out"
            style={{
              width: "52px",
              height: "300px",
              transformOrigin: "top",
              transform: visible ? "scaleY(1)" : "scaleY(0)",
              opacity: visible ? 1 : 0,
            }}
          >
            <div
              className="absolute left-1/2 -translate-x-1/2"
              style={{
                top: "-14px",
                width: "150px",
                height: "320px",
                background:
                  "linear-gradient(180deg, rgba(255,77,43,0) 0%, rgba(255,66,38,0.3) 50%, rgba(255,52,30,0) 100%)",
                filter: "blur(20px)",
              }}
            />
            <div
              className="absolute left-1/2 -translate-x-1/2 top-0"
              style={{
                width: "38px",
                height: "100%",
                background:
                  "linear-gradient(180deg, rgba(255,90,51,0.1) 0%, #FF5633 48%, rgba(255,62,35,0.05) 100%)",
                boxShadow: "0 0 30px rgba(255,72,40,0.2)",
              }}
            />
          </div>
        </div>

        <div className="relative z-10 flex items-end justify-between mt-8">
          <div style={fade(0.2, "x", -14)} className="transition-all duration-700 ease-out">
            <div style={{ fontSize: "48px", fontWeight: 500, lineHeight: 0.84, letterSpacing: "-0.05em", color: "rgba(255,255,255,0.72)" }}>
              35%
            </div>
            <div className="mt-2" style={{ fontSize: "8px", fontWeight: 600, letterSpacing: "0.14em", color: "rgba(255,255,255,0.28)" }}>
              BUSINESSES FOCUS ON
            </div>
          </div>
          <div style={fade(0.3, "x", 14)} className="text-right transition-all duration-700 ease-out">
            <div style={{ fontSize: "52px", fontWeight: 600, lineHeight: 0.84, letterSpacing: "-0.05em", color: "#FFFFFF" }}>
              85%
            </div>
            <div className="mt-2" style={{ fontSize: "8px", fontWeight: 700, letterSpacing: "0.14em", color: "#FF6644" }}>
              WHAT AI EVALUATES
            </div>
          </div>
        </div>

        <p className="relative z-10 text-center mt-10" style={{ fontSize: "8px", letterSpacing: "0.06em", color: "rgba(255,255,255,0.28)" }}>
          IDENTITY · SCHEMA · LOCATION · AUTHORITY · KNOWLEDGE · FRESHNESS
        </p>
      </div>

      {/* Bottom statement — shared across breakpoints */}
      <div className="relative z-10 max-w-[820px] mx-auto px-6 pb-20 md:pb-24 pt-2">
        <p className="text-center text-[17px] md:text-[19px] font-medium leading-[1.5] tracking-[-0.02em] text-white/[0.78]">
          Looking impressive can help a customer trust you. Being structured,
          consistent and understandable helps AI know when to recommend you.
        </p>
      </div>
    </div>
  );
}
