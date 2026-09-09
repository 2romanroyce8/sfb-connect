"use client";

import { Calendar, Mail, MessageSquare, Bot, Pause } from "lucide-react";

// Visual composition (frame-in-frame, floating icon row, progress segments,
// giant pill CTA, floating pause control) is a faithful recreation of the
// reference card. The four floating icons intentionally represent SFB
// Connects' actual integrations (Calendar, Email, SMS, AI Provider) rather
// than reusing the reference's arbitrary third-party logos (e.g. Slack) —
// we don't have a Slack integration, so we never imply one.
export default function IntegrationsHeroCard() {
  return (
    <div
      className="relative w-full mx-auto mb-10"
      style={{ maxWidth: 560, aspectRatio: "0.93 / 1" }}
    >
      {/* depth layer behind */}
      <div
        className="absolute rounded-[36px]"
        style={{
          left: "3%",
          right: "-3%",
          top: 0,
          bottom: "-3%",
          background: "#0C0C0C",
          border: "1px solid rgba(255,255,255,0.08)",
          zIndex: 0,
        }}
      />

      {/* outer frame */}
      <div
        className="absolute inset-0 rounded-[34px]"
        style={{
          background: "linear-gradient(180deg, #121212 0%, #0E0E0E 100%)",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 26px 80px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.035)",
          zIndex: 1,
        }}
      >
        {/* inner card */}
        <div
          className="absolute rounded-[30px] overflow-hidden"
          style={{
            left: "9%",
            right: "9%",
            top: "8%",
            bottom: "8%",
            background: "linear-gradient(180deg, #171717 0%, #111111 100%)",
            border: "1px solid rgba(255,255,255,0.18)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02), 0 20px 60px rgba(0,0,0,0.25)",
          }}
        >
          {/* top progress segments */}
          <div
            className="absolute grid grid-cols-4"
            style={{ top: "7%", left: "8%", right: "8%", gap: 12 }}
          >
            {[true, true, false, false].map((active, i) => (
              <div
                key={i}
                style={{
                  height: 3,
                  borderRadius: 999,
                  background: active ? "#F3F3F3" : "#4A4A4A",
                }}
              />
            ))}
          </div>

          {/* floating integration icons */}
          <div
            className="absolute"
            style={{
              top: "17%",
              left: "8%",
              right: "8%",
              height: "32%",
              borderBottom: "1px solid rgba(95,83,255,0.28)",
            }}
          >
            <div
              className="absolute rounded-[20px] flex items-center justify-center integrations-float"
              style={{
                left: "6%",
                top: "24%",
                width: 58,
                height: 58,
                background: "linear-gradient(180deg, #4D4D4D 0%, #252525 100%)",
                border: "1px solid rgba(255,255,255,0.14)",
                boxShadow: "0 16px 34px rgba(0,0,0,0.30)",
                transform: "rotate(-4deg)",
                animationDelay: "0s",
              }}
            >
              <Calendar size={26} className="text-white/90" strokeWidth={1.75} />
            </div>

            <div
              className="absolute rounded-[16px] flex items-center justify-center integrations-float"
              style={{
                left: "29%",
                top: "48%",
                width: 44,
                height: 44,
                background: "linear-gradient(180deg, #A621EF 0%, #7A11C4 100%)",
                boxShadow: "0 16px 34px rgba(0,0,0,0.30)",
                transform: "rotate(-4deg)",
                animationDelay: "1.4s",
              }}
            >
              <Mail size={20} className="text-white" strokeWidth={1.75} />
            </div>

            <div
              className="absolute rounded-[15px] flex items-center justify-center integrations-float"
              style={{
                left: "56%",
                top: "16%",
                width: 42,
                height: 42,
                background: "#F2F2F2",
                boxShadow: "0 16px 34px rgba(0,0,0,0.30)",
                transform: "rotate(-4deg)",
                animationDelay: "0.7s",
              }}
            >
              <MessageSquare size={19} className="text-[#E9A61B]" strokeWidth={2} />
            </div>

            <div
              className="absolute rounded-[19px] flex items-center justify-center integrations-float"
              style={{
                right: "9%",
                top: "16%",
                width: 60,
                height: 60,
                background: "#F2F2F2",
                boxShadow: "0 16px 34px rgba(0,0,0,0.30)",
                transform: "rotate(-4deg)",
                animationDelay: "2.1s",
              }}
            >
              <Bot size={28} className="text-[#7A5CFF]" strokeWidth={1.75} />
            </div>

            {/* ambient dots */}
            {[
              { left: "36%", top: "22%" },
              { left: "60%", top: "40%" },
              { left: "78%", top: "30%" },
              { left: "16%", top: "10%" },
            ].map((d, i) => (
              <span
                key={i}
                className="absolute rounded-full"
                style={{ ...d, width: 3, height: 3, background: "rgba(255,255,255,0.8)" }}
              />
            ))}

            {/* purple glow line at bottom of visual area */}
            <div
              className="absolute left-0 right-0 bottom-0"
              style={{
                height: 1,
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(91,61,255,0.35) 35%, rgba(97,64,255,0.50) 55%, transparent 100%)",
                boxShadow: "0 0 18px rgba(93,65,255,0.22)",
              }}
            />
          </div>

          {/* content block */}
          <div
            className="absolute flex flex-col"
            style={{ left: "7%", right: "7%", top: "53%", bottom: "5%" }}
          >
            <div
              className="font-medium text-[#F4F4F4]"
              style={{ fontSize: 26, letterSpacing: "-0.03em", lineHeight: 1.05 }}
            >
              Integrations
            </div>
            <p
              className="mt-[10px] text-[#B4B4B6]"
              style={{ fontSize: 14.5, fontWeight: 400, letterSpacing: "-0.01em", lineHeight: 1.45 }}
            >
              Connect your calendar, email, and messaging tools to run the
              Sales OS from one place.
            </p>

            <a
              href="#my-calendar"
              className="mt-auto flex items-center justify-center gap-2 transition-colors"
              style={{
                height: 52,
                borderRadius: 40,
                background: "linear-gradient(180deg, #262626 0%, #1D1D1D 100%)",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 28px rgba(0,0,0,0.22)",
              }}
            >
              <span className="text-[#F3F3F3] font-medium" style={{ fontSize: 15, letterSpacing: "-0.02em" }}>
                Connect Integrations
              </span>
              <span className="text-[#F3F3F3]" style={{ fontSize: 17 }}>
                →
              </span>
            </a>
          </div>
        </div>

        {/* floating pause button */}
        <div
          className="absolute rounded-full flex items-center justify-center"
          style={{
            right: "8.5%",
            bottom: "3.5%",
            width: 56,
            height: 56,
            background: "radial-gradient(circle at 45% 35%, #4A4A4C 0%, #2C2C2F 56%, #1E1738 100%)",
            border: "1px solid rgba(255,255,255,0.18)",
            boxShadow: "0 18px 36px rgba(0,0,0,0.35)",
            zIndex: 10,
          }}
        >
          <Pause size={18} className="text-[#F0F0F0]" fill="currentColor" strokeWidth={0} />
        </div>
      </div>

      <style jsx>{`
        @keyframes integrationsFloat {
          0% {
            transform: translateY(-3px) rotate(-4deg);
          }
          50% {
            transform: translateY(3px) rotate(-4deg);
          }
          100% {
            transform: translateY(-3px) rotate(-4deg);
          }
        }
        .integrations-float {
          animation: integrationsFloat 8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
