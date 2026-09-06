"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowUpRight, Paperclip, Globe2, ChevronDown, X } from "lucide-react";
import { normalizeUrl, canonicalDomain, classifyLink } from "@/lib/research/normalize";
import type { ResearchScope } from "@/lib/research/LeadProfileBuilder";

const SCOPE_OPTIONS: { value: ResearchScope; label: string; description: string }[] = [
  { value: "public_web", label: "Public Web", description: "Full research fan-out — identify, crawl, discover everything." },
  { value: "website_only", label: "Website Only", description: "Restrict to the official website and its own pages." },
  { value: "social_profile", label: "Social Profile", description: "Seed from a social profile, then expand to the official site." },
  { value: "google_business", label: "Google Business", description: "Seed from a Google Business / Maps listing." },
  { value: "quick_contact", label: "Quick Contact Search", description: "Just phone, email, website and contact channels — no deep crawl." },
];

function sourceTypeLabel(url: string): string {
  const cls = classifyLink(url);
  if (cls.kind === "social") return cls.platform.charAt(0).toUpperCase() + cls.platform.slice(1);
  if (cls.kind === "whatsapp") return "WhatsApp";
  if (cls.kind === "booking") return "Booking Page";
  const domain = canonicalDomain(url) || "";
  if (domain.includes("google.com") || domain.includes("g.page")) return "Google Business";
  return "Website";
}

export default function LeadResearchCommandBar({
  onSubmit,
  disabled,
}: {
  onSubmit: (sources: string[], scope: ResearchScope) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const [secondSource, setSecondSource] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [scope, setScope] = useState<ResearchScope>("public_web");
  const [modeOpen, setModeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const modeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (modeRef.current && !modeRef.current.contains(e.target as Node)) setModeOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const preview = (() => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = normalizeUrl(trimmed);
    const domain = canonicalDomain(normalized);
    if (!domain || !domain.includes(".")) return null;
    return { domain, type: sourceTypeLabel(normalized) };
  })();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Enter a valid public business URL.");
      return;
    }
    const normalized = normalizeUrl(trimmed);
    const domain = canonicalDomain(normalized);
    if (!domain || !domain.includes(".")) {
      setError("This source could not be recognized.");
      return;
    }
    const sources = [normalized];
    const trimmedSecond = secondSource.trim();
    if (trimmedSecond) {
      const normalizedSecond = normalizeUrl(trimmedSecond);
      if (canonicalDomain(normalizedSecond)) sources.push(normalizedSecond);
    }
    setError(null);
    onSubmit(sources, scope);
  }

  const activeScope = SCOPE_OPTIONS.find((s) => s.value === scope)!;

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit}>
        <div
          className="relative flex items-center w-full overflow-hidden transition-shadow"
          style={{
            height: "clamp(84px, 8vw, 96px)",
            maxWidth: 820,
            background: "linear-gradient(180deg, #101010 0%, #080808 100%)",
            border: `1px solid ${focused ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.11)"}`,
            borderRadius: 28,
            boxShadow: focused ? "0 28px 90px rgba(0,0,0,0.50)" : "0 28px 90px rgba(0,0,0,0.46), inset 0 1px 0 rgba(255,255,255,0.035)",
          }}
        >
          {/* Soft moving research scan glow */}
          <div
            className="absolute pointer-events-none research-scan-glow"
            style={{
              top: 0,
              bottom: 0,
              right: 35,
              width: 240,
              zIndex: 2,
              background:
                "radial-gradient(ellipse at center, rgba(200,255,130,0.80) 0%, rgba(120,200,70,0.38) 23%, rgba(65,130,42,0.16) 48%, rgba(0,0,0,0) 76%)",
              filter: "blur(12px)",
              opacity: 0.68,
              mixBlendMode: "screen",
            }}
          />

          <input
            ref={inputRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={disabled}
            placeholder="Paste a business link"
            className="relative w-full h-full bg-transparent outline-none"
            style={{
              padding: "0 110px 0 42px",
              fontSize: "clamp(34px, 3.2vw, 42px)",
              fontWeight: 300,
              letterSpacing: "-0.04em",
              color: "#F5F5F7",
              caretColor: "#FFFFFF",
              zIndex: 4,
              WebkitMaskImage: "linear-gradient(90deg, #000 0%, #000 58%, rgba(0,0,0,0.45) 76%, transparent 100%)",
              maskImage: "linear-gradient(90deg, #000 0%, #000 58%, rgba(0,0,0,0.45) 76%, transparent 100%)",
            }}
          />

          <button
            type="submit"
            disabled={disabled || !value.trim()}
            className="absolute flex items-center justify-center transition-colors"
            style={{
              right: 18,
              top: "50%",
              transform: "translateY(-50%)",
              width: 62,
              height: 62,
              borderRadius: 18,
              background: "rgba(255,255,255,0.055)",
              border: "1px solid rgba(255,255,255,0.07)",
              zIndex: 5,
              opacity: disabled || !value.trim() ? 0.3 : 1,
              cursor: disabled || !value.trim() ? "not-allowed" : "pointer",
            }}
          >
            <ArrowUpRight size={28} strokeWidth={1.5} color="#E7E7E7" />
          </button>
        </div>

        {preview && !error && (
          <div className="mt-3 pl-2.5 text-[12px]" style={{ color: "#6E6E73" }}>
            {preview.domain} · {preview.type}
          </div>
        )}
        {error && (
          <div className="mt-3 pl-2.5 text-[13px]" style={{ color: "#FF6B6B" }}>
            {error}
          </div>
        )}

        {/* Control row */}
        <div className="flex items-center gap-2.5 flex-wrap" style={{ marginTop: 18, paddingLeft: 8 }}>
          <div className="relative shrink-0" title="Research Agent Online">
            <div
              className="flex items-center justify-center rounded-full"
              style={{ width: 54, height: 54, background: "#101010", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <span className="font-semibold" style={{ fontSize: 15, color: "#F5F5F7" }}>
                SFB
              </span>
            </div>
            <span
              className="absolute rounded-full"
              style={{ width: 8, height: 8, background: "#30D158", right: 7, bottom: 7, boxShadow: "0 0 10px rgba(48,209,88,0.38)" }}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAttach((v) => !v)}
            title="Attach a second source"
            className="flex items-center justify-center rounded-full shrink-0 transition-colors"
            style={{
              width: 54,
              height: 54,
              background: showAttach ? "#181818" : "#101010",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <Paperclip size={20} color={showAttach ? "#A1A1A6" : "#5E5E5E"} />
          </button>

          <div className="relative" ref={modeRef}>
            <button
              type="button"
              onClick={() => setModeOpen((v) => !v)}
              className="flex items-center gap-2 shrink-0"
              style={{
                height: 54,
                minWidth: 170,
                padding: "0 20px",
                borderRadius: 27,
                background: "#101010",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <Globe2 size={18} color="#5F5F5F" />
              <span style={{ fontSize: 14, fontWeight: 400, color: "#8A8A8A" }} className="truncate">
                {activeScope.label}
              </span>
              <ChevronDown size={13} color="#5F5F5F" className="ml-auto shrink-0" style={{ transform: modeOpen ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
            </button>

            {modeOpen && (
              <div
                className="absolute bottom-full left-0 mb-2 rounded-[14px] overflow-hidden p-1.5"
                style={{ width: 300, background: "#0C0C0C", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}
              >
                {SCOPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setScope(opt.value);
                      setModeOpen(false);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-[9px] transition-colors"
                    style={{ background: scope === opt.value ? "rgba(255,255,255,0.06)" : "transparent" }}
                  >
                    <div className="text-[13px] text-white/85">{opt.label}</div>
                    <div className="text-[11px] text-white/35 mt-0.5">{opt.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {showAttach && (
          <div className="mt-3 pl-2.5 flex items-center gap-2 max-w-[420px]">
            <input
              value={secondSource}
              onChange={(e) => setSecondSource(e.target.value)}
              placeholder="Add a second source (optional)"
              className="flex-1 h-[42px] rounded-[10px] px-3.5 text-[13px] outline-none"
              style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
            />
            {secondSource && (
              <button type="button" onClick={() => setSecondSource("")} className="text-[#6E6E73] hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </form>

      <style jsx global>{`
        @keyframes researchScan {
          0% {
            transform: translateX(-80px) scaleX(0.78);
            opacity: 0.28;
          }
          50% {
            transform: translateX(60px) scaleX(1.06);
            opacity: 0.7;
          }
          100% {
            transform: translateX(-80px) scaleX(0.78);
            opacity: 0.28;
          }
        }
        .research-scan-glow {
          animation: researchScan 4.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
