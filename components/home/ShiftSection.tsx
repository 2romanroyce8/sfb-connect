"use client";

import { useEffect, useRef, useState } from "react";
import {
  MessageSquare,
  MoreHorizontal,
  ArrowUp,
  ArrowRight,
  MapPin,
  Globe2,
  Sparkles,
  Check,
  AlertCircle,
  X,
  Loader2,
} from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";
import { useBusinessLookup } from "@/lib/businessLookupContext";
import type { AISummary, LookupResult as ContextLookupResult } from "@/lib/businessLookupContext";
import MarketPositionPanel from "@/components/ui/MarketPositionPanel";

const RESEARCH_STEPS = [
  "Finding your business",
  "Checking your website",
  "Reading public business information",
  "Verifying identity",
  "Analyzing AI-readable signals",
  "Building your result",
];

type VerifiedField<T> = {
  value: T | null;
  status: "confirmed" | "uncertain" | "not_found";
  confidence: number;
  sources: string[];
};

type LookupResult = {
  business: {
    name: VerifiedField<string>;
    website: VerifiedField<string>;
    phone: VerifiedField<string>;
    location: VerifiedField<string>;
    category: VerifiedField<string>;
  };
  scores: {
    overall: number;
    identity: number;
    knowledge: number;
    authority: number;
    location: number;
    machineReadability: number;
  };
  strengths: string[];
  gaps: string[];
  missing: string[];
  sources: string[];
};

type LookupState =
  | { status: "idle" }
  | { status: "researching" }
  | { status: "needs_link"; message: string }
  | { status: "failed"; message: string }
  | { status: "completed"; result: LookupResult; summary: AISummary | null };

async function runLookup(query: string, location: string): Promise<LookupState> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return { status: "failed", message: "Lookup is temporarily unavailable." };
  }
  try {
    const res = await fetch(`${url}/functions/v1/business-lookup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
      body: JSON.stringify({ query, location: location || undefined }),
    });
    const data = await res.json();
    if (data.status === "completed")
      return { status: "completed", result: data.result, summary: data.summary ?? null };
    if (data.status === "needs_link")
      return { status: "needs_link", message: data.message };
    return { status: "failed", message: data.message || "Something went wrong." };
  } catch {
    return {
      status: "failed",
      message: "We couldn't reach the lookup service. Try again in a moment.",
    };
  }
}

function ScoreDial({ score }: { score: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let cur = 0;
    const interval = setInterval(() => {
      cur += 2;
      if (cur >= score) {
        setDisplay(score);
        clearInterval(interval);
      } else setDisplay(cur);
    }, 14);
    return () => clearInterval(interval);
  }, [score]);
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-[92px] h-[92px] shrink-0">
      <svg viewBox="0 0 92 92" className="w-full h-full -rotate-90">
        <circle cx="46" cy="46" r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="8" />
        <circle
          cx="46"
          cy="46"
          r={r}
          fill="none"
          stroke="#ffffff"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - display / 100)}
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-semibold text-white leading-none">{display}</span>
        <span className="text-[9px] tracking-wide text-white/[0.34] mt-0.5">AI PRESENCE</span>
      </div>
    </div>
  );
}

const STATUS_COLOR: Record<VerifiedField<string>["status"], string> = {
  confirmed: "#30D158",
  uncertain: "#FFD60A",
  not_found: "#FF453A",
};

function VerificationCard({ label, field }: { label: string; field: VerifiedField<string> }) {
  return (
    <div className="p-[11px] rounded-[12px] bg-[#151515] border border-white/[0.07]">
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-[0.08em] text-white/30">{label}</span>
        <span
          className="w-[6px] h-[6px] rounded-full shrink-0"
          style={{ background: STATUS_COLOR[field.status] }}
        />
      </div>
      <div className="mt-[5px] text-[12px] font-medium text-white truncate">
        {field.value || "Not found"}
      </div>
    </div>
  );
}

function ScoreBar({ label, score, delay }: { label: string; score: number; delay: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(score), 100 + delay);
    return () => clearTimeout(t);
  }, [score, delay]);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-white/[0.46]">{label}</span>
        <span className="text-[10px] text-white/[0.46]">{score}</span>
      </div>
      <div className="h-[7px] rounded-full bg-[#1d1d1d] overflow-hidden">
        <div
          className="h-full rounded-full bg-white transition-[width] duration-700 ease-out"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function AiChatPanel({ onStatusChange }: { onStatusChange?: (status: LookupState["status"]) => void }) {
  const { selectedBusiness, summary, setLookupResult, pendingChatMessage, clearPendingChatMessage } =
    useBusinessLookup();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [state, setState] = useState<LookupState>({ status: "idle" });
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    onStatusChange?.(state.status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  // If a business was already searched elsewhere (e.g. the hero's live
  // lookup) before this panel mounted/rendered, reflect that same canonical
  // result here instead of showing an empty search form.
  useEffect(() => {
    if (selectedBusiness && state.status === "idle") {
      setState({ status: "completed", result: selectedBusiness, summary });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBusiness]);

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
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (state.status !== "researching") return;
    setStepIndex(0);
    const interval = setInterval(() => {
      setStepIndex((i) => (i < RESEARCH_STEPS.length - 1 ? i + 1 : i));
    }, 900);
    return () => clearInterval(interval);
  }, [state.status]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    clearPendingChatMessage();
    setState({ status: "researching" });
    const result = await runLookup(query, location);
    setState(result);
    if (result.status === "completed") {
      setLookupResult(result.result, result.summary);
      // The left market-position panel and this panel both stay on screen
      // and populate in place -- no redirect away from this section.
    } else {
      setLookupResult(null, null);
    }
  }

  return (
    <div
      ref={ref}
      className={`ai-chat-panel${
        visible ? " is-visible" : ""
      } bg-[#111111] border border-white/[0.14] rounded-[24px] overflow-hidden min-h-[500px] shadow-[0_30px_100px_rgba(0,0,0,0.45)] flex flex-col`}
    >
      <div className="flex items-center justify-between h-[58px] px-[18px] border-b border-white/[0.08] shrink-0">
        <div className="flex items-center gap-2 text-[13px] font-medium text-white/[0.74]">
          {state.status === "completed" ? (
            <Sparkles size={15} strokeWidth={1.75} />
          ) : (
            <MessageSquare size={15} strokeWidth={1.75} />
          )}
          {state.status === "completed" ? "SFB AI Presence" : "AI Assistant"}
        </div>
        <MoreHorizontal size={16} className="text-white/40" />
      </div>

      <div className="p-[22px] flex-1 flex flex-col">
        {state.status === "idle" && (
          <div className="ai-chat-fade flex flex-col flex-1" style={{ transitionDelay: "0.1s" }}>
            <div className="flex items-start gap-2.5 mb-5">
              <div className="w-[30px] h-[30px] rounded-full bg-[#F5F5F7] text-[#111111] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                AI
              </div>
              <p className="text-[15px] leading-[1.6] text-[#C7C7CC]">
                See how AI understands your business. Enter your business name,
                website, or social profile and we&apos;ll analyze the public
                information AI systems can find about you.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="relative rounded-[18px] bg-[#181818] border border-white/[0.07] overflow-hidden">
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e as unknown as React.FormEvent);
                    }
                  }}
                  placeholder="Enter your business name, website, or social profile"
                  rows={3}
                  className="w-full min-h-[92px] px-[18px] pt-[18px] pb-2 bg-transparent border-none outline-none resize-none text-[15px] leading-[1.45] text-[#F5F5F7] placeholder:text-[#717176]"
                />

                <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="h-[34px] px-2.5 rounded-[9px] bg-[#202020] border border-white/[0.06] flex items-center gap-[7px]">
                      <MapPin size={13} className="text-[#A1A1A6] shrink-0" />
                      <input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="City, State"
                        className="w-[90px] sm:w-[118px] bg-transparent border-none outline-none text-[12px] text-[#D1D1D6] placeholder:text-[#6E6E73]"
                      />
                    </div>
                    <div className="h-[34px] px-2.5 rounded-[9px] bg-[#202020] border border-white/[0.06] flex items-center gap-[6px]">
                      <Globe2 size={13} className="text-[#A1A1A6]" />
                      <span className="text-[12px] text-[#A1A1A6]">Public</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    aria-label="Check My AI Presence"
                    className="w-10 h-[34px] rounded-[9px] flex items-center justify-center shrink-0 border border-white/[0.08] transition-[filter] hover:brightness-110"
                    style={{ background: "linear-gradient(135deg, #FF5A36 0%, #E98A1B 100%)" }}
                  >
                    <ArrowRight size={15} className="text-white" />
                  </button>
                </div>

                {/* subtle warm accent edge, referencing the reference composer without going neon */}
                <div
                  className="absolute left-0 right-0 bottom-0 h-[4px] pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(235,46,126,0.95) 0%, rgba(255,72,40,0.95) 22%, rgba(246,131,29,0.85) 44%, rgba(55,55,55,0.15) 72%, rgba(0,0,0,0) 100%)",
                    boxShadow: "0 -8px 28px rgba(255,80,45,0.10)",
                  }}
                />
              </div>
            </form>

            <p className="mt-3 text-[11px] text-[#5F5F63]">
              We only look at publicly accessible information — no logins,
              no guessing.
            </p>
          </div>
        )}

        {state.status === "researching" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5">
            <Loader2 size={28} className="text-white/60 animate-spin" />
            <div className="text-[13px] text-white/70">{RESEARCH_STEPS[stepIndex]}</div>
            <div className="w-full max-w-[220px] flex flex-col gap-1.5">
              {RESEARCH_STEPS.map((s, i) => (
                <div
                  key={s}
                  className={`text-[11px] transition-colors ${
                    i <= stepIndex ? "text-white/60" : "text-white/20"
                  }`}
                >
                  {i < stepIndex ? "✓ " : i === stepIndex ? "… " : ""}
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}

        {(state.status === "needs_link" || state.status === "failed") && (
          <div className="flex-1 flex flex-col">
            <div className="flex items-start gap-2.5 mb-5">
              <div className="w-[30px] h-[30px] rounded-full bg-[#F5F5F7] text-[#111111] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                AI
              </div>
              <p className="text-[15px] leading-[1.6] text-[#C7C7CC]">
                {state.message}
              </p>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="relative rounded-[18px] bg-[#181818] border border-white/[0.07] overflow-hidden flex items-center">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="yourbusiness.com or instagram.com/yourbusiness"
                  className="flex-1 h-[54px] px-[18px] bg-transparent border-none outline-none text-[15px] text-[#F5F5F7] placeholder:text-[#717176]"
                />
                <button
                  type="submit"
                  aria-label="Try again"
                  className="w-10 h-[34px] mr-2.5 rounded-[9px] flex items-center justify-center shrink-0 border border-white/[0.08] transition-[filter] hover:brightness-110"
                  style={{ background: "linear-gradient(135deg, #FF5A36 0%, #E98A1B 100%)" }}
                >
                  <ArrowRight size={15} className="text-white" />
                </button>
                <div
                  className="absolute left-0 right-0 bottom-0 h-[4px] pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(235,46,126,0.95) 0%, rgba(255,72,40,0.95) 22%, rgba(246,131,29,0.85) 44%, rgba(55,55,55,0.15) 72%, rgba(0,0,0,0) 100%)",
                    boxShadow: "0 -8px 28px rgba(255,80,45,0.10)",
                  }}
                />
              </div>
            </form>
          </div>
        )}

        {state.status === "completed" && (
          <div className="ai-chat-fade flex-1 flex flex-col overflow-y-auto" style={{ transitionDelay: "0.05s" }}>
            {/* 1. Business + score */}
            <div className="grid grid-cols-[92px_1fr] gap-[18px] items-center p-[18px] rounded-[18px] bg-[#171717] border border-white/[0.09] mb-4">
              <ScoreDial score={state.result.scores.overall} />
              <div className="min-w-0">
                <div className="text-[20px] font-semibold tracking-[-0.025em] text-white truncate">
                  {state.result.business.name.value || "Unknown business"}
                </div>
                <div className="mt-1 text-[12px] text-white/[0.38] truncate">
                  {state.result.business.website.value}
                </div>
                <span className="inline-flex mt-[10px] px-2 py-[5px] rounded-full bg-white/[0.05] border border-white/[0.08] text-[9px] text-white/[0.54]">
                  AI Presence Preview
                </span>
              </div>
            </div>

            {/* 2. Verified business information */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <VerificationCard label="Phone" field={state.result.business.phone} />
              <VerificationCard label="Location" field={state.result.business.location} />
              <VerificationCard label="Category" field={state.result.business.category} />
            </div>

            {/* 3. Five AI presence category scores */}
            <div className="mb-4">
              <div className="text-[12px] font-medium text-white/[0.62] mb-3">
                How AI understands this business
              </div>
              <div className="flex flex-col gap-[11px]">
                <ScoreBar label="Identity" score={state.result.scores.identity} delay={0} />
                <ScoreBar label="Knowledge" score={state.result.scores.knowledge} delay={60} />
                <ScoreBar label="Authority" score={state.result.scores.authority} delay={120} />
                <ScoreBar label="Location" score={state.result.scores.location} delay={180} />
                <ScoreBar
                  label="Machine Readability"
                  score={state.result.scores.machineReadability}
                  delay={240}
                />
              </div>
            </div>

            {/* 4 & 5. AI understands / AI may struggle with */}
            {(state.result.strengths.length > 0 || state.result.gaps.length > 0) && (
              <div className="grid grid-cols-2 gap-[10px] mb-3">
                {state.result.strengths.length > 0 && (
                  <div className="p-[14px] rounded-[14px] bg-[#141414] border border-[rgba(48,209,88,0.10)]">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-white/[0.42] mb-2">
                      AI understands
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {state.result.strengths.map((s) => (
                        <div key={s} className="flex items-start gap-1.5 text-[12px] leading-[1.45] text-white/[0.72]">
                          <Check size={12} className="text-[#30D158] mt-[2px] shrink-0" />
                          {s}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {state.result.gaps.length > 0 && (
                  <div className="p-[14px] rounded-[14px] bg-[#141414] border border-[rgba(255,214,10,0.10)]">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-white/[0.42] mb-2">
                      AI may struggle with
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {state.result.gaps.map((g) => (
                        <div key={g} className="flex items-start gap-1.5 text-[12px] leading-[1.45] text-white/[0.72]">
                          <AlertCircle size={12} className="text-[#FFD60A] mt-[2px] shrink-0" />
                          {g}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 6. Unverified signals */}
            {state.result.missing.length > 0 && (
              <div className="p-[13px_14px] rounded-[14px] bg-[#121212] border border-[rgba(255,69,58,0.10)] mb-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-white/[0.42] mb-2">
                  Unable to verify
                </div>
                <div className="flex flex-col gap-1">
                  {state.result.missing.map((m) => (
                    <div key={m} className="flex items-start gap-1.5 text-[11px] text-white/[0.56]">
                      <X size={11} className="text-[#FF453A] mt-[2px] shrink-0" />
                      {m}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7. Sources */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-white/[0.34]">Signals checked</span>
              <div className="flex gap-1.5 flex-wrap justify-end">
                {state.result.sources.map((s) => (
                  <span
                    key={s}
                    className="h-6 px-2 inline-flex items-center rounded-full bg-[#171717] border border-white/[0.07] text-[9px] text-white/[0.44] capitalize"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Follow-up question, e.g. from "Improve My Score" */}
            {pendingChatMessage && state.summary && (
              <div className="mt-4">
                <div className="ml-auto mb-2 max-w-[85%] inline-block bg-[#2A2A2A] text-[#F3F3F3] rounded-[14px_14px_4px_14px] px-3 py-2 text-[12px] block w-fit">
                  {pendingChatMessage}
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-white text-black flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                    AI
                  </div>
                  <div className="text-[12px] leading-relaxed text-white/80">
                    Based on your researched result, start here:{" "}
                    {state.summary.recommendedNextSteps.join(" Then, ")}.
                  </div>
                </div>
              </div>
            )}

            {/* 8. Full audit CTA */}
            <div className="mt-[18px] pt-4 border-t border-white/[0.06]">
              <a
                href="#pricing"
                className="h-[48px] rounded-[12px] bg-white text-black text-[13px] font-semibold flex items-center justify-center gap-1.5 hover:scale-[1.01] transition-transform"
              >
                Get My Full AI Presence Audit
              </a>
              <button
                onClick={() => {
                  setQuery("");
                  setLocation("");
                  setState({ status: "idle" });
                  setLookupResult(null, null);
                  clearPendingChatMessage();
                }}
                className="w-full mt-3 h-[24px] text-[11px] text-white/[0.36] hover:text-white transition-colors"
              >
                Check another business
              </button>
            </div>
          </div>
        )}
      </div>

      {state.status === "idle" && (
        <div className="mx-[18px] mb-[18px] h-[48px] shrink-0 bg-[#161616] border border-white/[0.06] rounded-[14px] flex items-center justify-between pl-[14px] pr-2.5 opacity-40 pointer-events-none">
          <span className="text-[12px] text-[#D1D1D6]">Ask a follow-up</span>
          <span className="w-[30px] h-[30px] rounded-[8px] bg-[#202020] flex items-center justify-center shrink-0">
            <ArrowUp size={13} className="text-[#737377]" />
          </span>
        </div>
      )}
    </div>
  );
}

const LOADING_STAGES = [
  "Identifying your business",
  "Determining your niche",
  "Determining your location",
  "Checking AI-visible sources",
  "Finding competitors",
  "Comparing market signals",
];

// This IS the results panel, not a placeholder that gets swapped out for
// something else. It has exactly three phases -- empty (before any
// search), loading (while one is running), and populated (a real,
// evidence-based MarketPositionPanel) -- and it never disappears once a
// business has been searched. A new search clears it back to loading,
// never back to nothing.
function MarketPositionColumn({
  status,
  business,
}: {
  status: LookupState["status"];
  business: ContextLookupResult | null;
}) {
  if (status === "completed" && business) {
    return <MarketPositionPanel business={business} />;
  }

  if (status === "researching") {
    return (
      <div className="bg-[#0D0D0D] border border-white/[0.12] rounded-[24px] p-7 min-h-[500px] flex flex-col">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40 mb-6">
          AI Discovery Market Position
        </div>
        <div className="flex-1 flex flex-col gap-1.5 justify-center max-w-[260px] mx-auto w-full">
          {LOADING_STAGES.map((s, i) => (
            <div key={s} className="text-[12px] text-white/40 py-1">
              {s}
            </div>
          ))}
        </div>
        <p className="mt-6 text-[12px] text-white/[0.36]">
          We&apos;ll compare your business against real public search results once your AI Presence result is ready.
        </p>
      </div>
    );
  }

  // Idle (and any other pre-result state): reserved, honest empty space —
  // no fake ranking, no fake business names, nothing shown before a real
  // search happens.
  return (
    <div className="bg-[#0D0D0D] border border-white/[0.12] rounded-[24px] p-7 min-h-[500px] flex flex-col items-center justify-center text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/30 mb-3">
        AI Discovery Market Position
      </div>
      <p className="max-w-[280px] text-[14px] leading-relaxed text-white/[0.42]">
        Search your business to see a real, evidence-based comparison against
        other businesses AI can find in your market.
      </p>
    </div>
  );
}

export default function ShiftSection() {
  const { selectedBusiness } = useBusinessLookup();
  const [chatStatus, setChatStatus] = useState<LookupState["status"]>("idle");

  return (
    <section className="py-24 md:py-32 section-band" id="shift">
      <div className="max-w-[1200px] mx-auto px-8">
        <Reveal>
          <SectionHead
            label="The Shift"
            title={
              <>
                Search gave people choices.
                <br />
                AI gives people{" "}
                <span className="font-serif-accent italic font-normal">
                  answers.
                </span>
              </>
            }
          />
        </Reveal>
        <Reveal>
          <div className="grid md:grid-cols-2 gap-7 items-stretch">
            <MarketPositionColumn status={chatStatus} business={selectedBusiness} />

            <AiChatPanel onStatusChange={setChatStatus} />
          </div>
        </Reveal>
        <Reveal>
          <p className="mt-14 text-lg md:text-xl leading-relaxed text-[#c7c7cc] max-w-[920px]">
            That difference changes the competition. Search makes customers
            evaluate options. AI increasingly evaluates options first and
            presents a shorter answer. Try it yourself — search your own
            business above.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
