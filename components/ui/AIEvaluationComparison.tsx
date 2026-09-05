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
      style={{ background: "#111214" }}
    >
      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 15,
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.16) 70%, rgba(0,0,0,0.48) 100%)",
        }}
      />

      {/* Grain */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 20,
          opacity: 0.035,
          mixBlendMode: "screen",
          backgroundImage: GRAIN_URL,
        }}
      />

      {/* ============ DESKTOP / TABLET — absolute cinematic composition ============ */}
      <div className="hidden md:block relative" style={{ height: "780px" }}>
        {/* Mountains — dark, soft, barely-there depth cue */}
        <svg
          className="absolute left-0 right-0 bottom-0 pointer-events-none"
          style={{ zIndex: 2, height: "250px", width: "100%", opacity: 0.75 }}
          viewBox="0 0 1600 250"
          preserveAspectRatio="none"
        >
          <path
            d="M0 250 L0 185 L170 115 L310 175 L445 90 L610 185 L790 120 L950 185 L1120 92 L1290 172 L1440 118 L1600 188 L1600 250 Z"
            fill="#17181B"
            opacity={0.48}
          />
          <path
            d="M0 250 L0 210 L210 165 L350 205 L510 135 L690 218 L835 175 L990 213 L1170 143 L1370 210 L1510 172 L1600 200 L1600 250 Z"
            fill="#0b0c0e"
            opacity={0.98}
          />
        </svg>

        {/* Atmosphere: dark cloud masses, concentrated low, no flat red wash */}
        <div
          className="absolute pointer-events-none"
          style={{
            zIndex: 3,
            left: "-12%",
            bottom: "6%",
            width: "58%",
            height: "48%",
            background:
              "radial-gradient(ellipse at 68% 45%, rgba(92,60,64,0.44) 0%, rgba(55,43,47,0.58) 28%, rgba(27,27,30,0.78) 58%, rgba(17,18,20,0) 82%)",
            filter: "blur(10px)",
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            zIndex: 3,
            right: "-12%",
            bottom: "6%",
            width: "58%",
            height: "48%",
            background:
              "radial-gradient(ellipse at 32% 44%, rgba(92,59,63,0.42) 0%, rgba(54,42,46,0.58) 29%, rgba(27,27,30,0.78) 58%, rgba(17,18,20,0) 82%)",
            filter: "blur(10px)",
          }}
        />

        {/* Rim-light seams — subtle, only where clouds meet the beam */}
        <div
          className="absolute pointer-events-none"
          style={{
            zIndex: 6,
            left: "19%",
            bottom: "25%",
            width: "28%",
            height: "18%",
            background:
              "radial-gradient(ellipse at 85% 50%, rgba(255,80,54,0.26) 0%, rgba(255,72,48,0.10) 34%, transparent 72%)",
            filter: "blur(10px)",
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            zIndex: 6,
            right: "19%",
            bottom: "25%",
            width: "28%",
            height: "18%",
            background:
              "radial-gradient(ellipse at 15% 50%, rgba(255,80,54,0.24) 0%, rgba(255,72,48,0.09) 34%, transparent 72%)",
            filter: "blur(10px)",
          }}
        />

        {/* Beam ground glow — small, concentrated near the beam base only */}
        <div
          className="absolute pointer-events-none"
          style={{
            zIndex: 6,
            left: "50%",
            bottom: "30px",
            transform: "translateX(-50%)",
            width: "360px",
            height: "110px",
            background:
              "radial-gradient(ellipse at center, rgba(255,76,46,0.20) 0%, rgba(255,68,42,0.08) 34%, transparent 72%)",
            filter: "blur(12px)",
          }}
        />

        {/* Headline — smaller, sits comfortably below the nav */}
        <div
          className="absolute left-1/2 text-center transition-all duration-700 ease-out"
          style={{
            top: "72px",
            width: "620px",
            maxWidth: "88vw",
            zIndex: 10,
            opacity: visible ? 1 : 0,
            transform: visible ? "translate(-50%, 0)" : "translate(-50%, 18px)",
          }}
        >
          <h2
            className="font-bold text-[#f4f4f4]"
            style={{
              fontSize: "clamp(2.6rem, 3.9vw, 4.3rem)",
              lineHeight: 0.88,
              letterSpacing: "-0.05em",
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
            className="mx-auto mt-3"
            style={{
              maxWidth: "480px",
              fontSize: "10px",
              lineHeight: 1.45,
              letterSpacing: "0.01em",
              color: "rgba(255,255,255,0.26)",
            }}
          >
            Businesses often focus on what people can see. AI evaluates the
            deeper signals that help it understand what your business is,
            where it operates, and when it should be recommended.
          </p>
        </div>

        {/* Center beam — shorter, narrower, dimmer */}
        <div
          className="absolute left-1/2 -translate-x-1/2 transition-transform duration-[1200ms] ease-out"
          style={{
            top: "250px",
            width: "56px",
            height: "430px",
            zIndex: 7,
            transformOrigin: "top",
            transform: visible ? "translateX(-50%) scaleY(1)" : "translateX(-50%) scaleY(0)",
            opacity: visible ? 1 : 0,
          }}
        >
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              top: "-14px",
              width: "140px",
              height: "470px",
              background:
                "linear-gradient(180deg, rgba(255,80,48,0) 0%, rgba(255,80,48,0.08) 18%, rgba(255,76,44,0.24) 48%, rgba(255,69,39,0.18) 72%, rgba(255,69,39,0) 100%)",
              filter: "blur(18px)",
            }}
          />
          <div
            className="absolute left-1/2 -translate-x-1/2 top-0"
            style={{
              width: "42px",
              height: "100%",
              background:
                "linear-gradient(180deg, rgba(255,88,53,0.04) 0%, rgba(255,85,50,0.22) 18%, rgba(255,81,48,0.62) 48%, #FF5A38 66%, rgba(255,77,45,0.26) 84%, rgba(255,70,42,0.03) 100%)",
              borderLeft: "1px solid rgba(255,135,100,0.08)",
              borderRight: "1px solid rgba(255,135,100,0.07)",
              boxShadow: "0 0 28px rgba(255,74,44,0.14)",
            }}
          />
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{
              top: "110px",
              width: "8px",
              height: "260px",
              background:
                "linear-gradient(180deg, rgba(255,153,125,0.05), rgba(255,107,72,0.55), rgba(255,79,47,0.85), rgba(255,77,45,0.12))",
              filter: "blur(4px)",
            }}
          />
          <div
            className="absolute left-1/2 top-0 bottom-0"
            style={{
              width: "1px",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.22), rgba(255,255,255,0.03))",
            }}
          />
        </div>

        {/* Left metric — close to the beam, lower */}
        <div
          className="absolute text-left transition-all duration-700 ease-out"
          style={{
            left: "31%",
            top: "430px",
            width: "180px",
            zIndex: 11,
            opacity: visible ? 1 : 0,
            transform: visible
              ? "translate(-50%, -50%)"
              : "translate(calc(-50% - 18px), -50%)",
            transitionDelay: "0.32s",
          }}
        >
          <div
            style={{
              fontSize: "58px",
              fontWeight: 500,
              lineHeight: 0.84,
              letterSpacing: "-0.06em",
              color: "rgba(255,255,255,0.72)",
            }}
          >
            35%
          </div>
          <div
            className="mt-2"
            style={{
              fontSize: "7px",
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.28)",
            }}
          >
            What Businesses Focus On
          </div>
          <div className="mt-[6px]" style={{ fontSize: "9px", color: "rgba(255,255,255,0.34)" }}>
            surface-level signals
          </div>
        </div>

        {/* Right metric — close to the beam, higher */}
        <div
          className="absolute text-left transition-all duration-700 ease-out"
          style={{
            right: "29%",
            top: "345px",
            width: "190px",
            zIndex: 11,
            opacity: visible ? 1 : 0,
            transform: visible
              ? "translate(50%, -50%)"
              : "translate(calc(50% + 18px), -50%)",
            transitionDelay: "0.4s",
          }}
        >
          <div
            style={{
              fontSize: "62px",
              fontWeight: 600,
              lineHeight: 0.84,
              letterSpacing: "-0.06em",
              color: "#FFFFFF",
            }}
          >
            85%
          </div>
          <div
            className="mt-2"
            style={{
              fontSize: "7px",
              fontWeight: 700,
              letterSpacing: "0.17em",
              textTransform: "uppercase",
              color: "#FF6A48",
            }}
          >
            What AI Actually Evaluates
          </div>
          <div className="mt-[6px]" style={{ fontSize: "9px", color: "rgba(255,255,255,0.40)" }}>
            structured discovery signals
          </div>
        </div>

        {/* Tiny editorial signal labels */}
        <div
          className="absolute"
          style={{ left: "17%", bottom: "46px", width: "260px", zIndex: 11, opacity: 0.9 }}
        >
          <div style={{ fontSize: "7px", letterSpacing: "0.18em", color: "rgba(255,255,255,0.22)" }}>
            VISIBLE SIGNALS
          </div>
          <div className="mt-[6px]" style={{ fontSize: "8px", letterSpacing: "0.05em", color: "rgba(255,255,255,0.20)" }}>
            LOGO · SOCIALS · WEBSITE DESIGN · FOLLOWERS
          </div>
        </div>
        <div
          className="absolute text-right"
          style={{ right: "14%", bottom: "46px", width: "320px", zIndex: 11, opacity: 0.9 }}
        >
          <div style={{ fontSize: "7px", letterSpacing: "0.18em", color: "rgba(255,102,68,0.48)" }}>
            AI DISCOVERY SIGNALS
          </div>
          <div className="mt-[6px]" style={{ fontSize: "8px", letterSpacing: "0.05em", color: "rgba(255,255,255,0.30)" }}>
            IDENTITY · SCHEMA · LOCATION · AUTHORITY · KNOWLEDGE · FRESHNESS
          </div>
        </div>
      </div>

      {/* ============ MOBILE — simplified stacked version ============ */}
      <div className="md:hidden relative px-6 pt-14 pb-10">
        <div
          className="absolute pointer-events-none"
          style={{
            zIndex: 1,
            left: "-18%",
            bottom: "8%",
            width: "70%",
            height: "36%",
            background:
              "radial-gradient(ellipse at center, rgba(92,60,64,0.4) 0%, rgba(27,27,30,0.6) 55%, transparent 78%)",
            filter: "blur(14px)",
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            zIndex: 1,
            right: "-18%",
            bottom: "5%",
            width: "70%",
            height: "36%",
            background:
              "radial-gradient(ellipse at center, rgba(92,59,63,0.38) 0%, rgba(27,27,30,0.62) 55%, transparent 78%)",
            filter: "blur(15px)",
          }}
        />
        <svg
          className="absolute left-0 right-0 bottom-0 pointer-events-none"
          style={{ zIndex: 2, height: "170px", width: "100%", opacity: 0.75 }}
          viewBox="0 0 1600 250"
          preserveAspectRatio="none"
        >
          <path
            d="M0 250 L0 185 L170 115 L310 175 L445 90 L610 185 L790 120 L950 185 L1120 92 L1290 172 L1440 118 L1600 188 L1600 250 Z"
            fill="#17181B"
            opacity={0.48}
          />
          <path
            d="M0 250 L0 210 L210 165 L350 205 L510 135 L690 218 L835 175 L990 213 L1170 143 L1370 210 L1510 172 L1600 200 L1600 250 Z"
            fill="#0b0c0e"
            opacity={0.98}
          />
        </svg>

        <div className="relative z-10 text-center transition-all duration-700 ease-out" style={fade(0)}>
          <h2
            className="font-bold text-[#f4f4f4]"
            style={{ fontSize: "clamp(2.4rem, 10vw, 3.6rem)", lineHeight: 0.9, letterSpacing: "-0.05em" }}
          >
            AI evaluates more than what{" "}
            <span className="font-serif-accent italic font-normal">
              looks impressive.
            </span>
          </h2>
          <p className="mx-auto mt-4" style={{ maxWidth: "310px", fontSize: "10px", color: "rgba(255,255,255,0.28)", lineHeight: 1.45 }}>
            Businesses often focus on what people can see. AI evaluates the
            deeper signals underneath the surface.
          </p>
        </div>

        <div className="relative z-10 flex flex-col items-center mt-9">
          <div
            className="relative transition-transform duration-[1100ms] ease-out"
            style={{
              width: "42px",
              height: "240px",
              transformOrigin: "top",
              transform: visible ? "scaleY(1)" : "scaleY(0)",
              opacity: visible ? 1 : 0,
            }}
          >
            <div
              className="absolute left-1/2 -translate-x-1/2"
              style={{
                top: "-10px",
                width: "110px",
                height: "260px",
                background:
                  "linear-gradient(180deg, rgba(255,80,48,0) 0%, rgba(255,76,44,0.22) 50%, rgba(255,69,39,0) 100%)",
                filter: "blur(16px)",
              }}
            />
            <div
              className="absolute left-1/2 -translate-x-1/2 top-0"
              style={{
                width: "30px",
                height: "100%",
                background:
                  "linear-gradient(180deg, rgba(255,90,51,0.08) 0%, #FF5A38 48%, rgba(255,70,42,0.04) 100%)",
                boxShadow: "0 0 22px rgba(255,74,44,0.16)",
              }}
            />
          </div>
        </div>

        <div className="relative z-10 flex items-end justify-between mt-7">
          <div style={fade(0.2, "x", -14)} className="transition-all duration-700 ease-out">
            <div style={{ fontSize: "42px", fontWeight: 500, lineHeight: 0.84, letterSpacing: "-0.05em", color: "rgba(255,255,255,0.72)" }}>
              35%
            </div>
            <div className="mt-2" style={{ fontSize: "7px", fontWeight: 600, letterSpacing: "0.14em", color: "rgba(255,255,255,0.28)" }}>
              BUSINESSES FOCUS ON
            </div>
          </div>
          <div style={fade(0.3, "x", 14)} className="text-right transition-all duration-700 ease-out">
            <div style={{ fontSize: "46px", fontWeight: 600, lineHeight: 0.84, letterSpacing: "-0.05em", color: "#FFFFFF" }}>
              85%
            </div>
            <div className="mt-2" style={{ fontSize: "7px", fontWeight: 700, letterSpacing: "0.14em", color: "#FF6A48" }}>
              WHAT AI EVALUATES
            </div>
          </div>
        </div>

        <p className="relative z-10 text-center mt-9" style={{ fontSize: "8px", letterSpacing: "0.06em", color: "rgba(255,255,255,0.26)" }}>
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
