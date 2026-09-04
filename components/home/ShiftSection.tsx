"use client";

import { useEffect, useRef, useState } from "react";
import {
  MessageSquare,
  MoreHorizontal,
  ArrowUp,
  Sparkles,
  Check,
  AlertCircle,
  X,
  Loader2,
} from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";

const OLD_RESULTS = [
  {
    domain: "localplumbingcompany.com",
    title: "Local Plumbing Company",
    description:
      "Plumbing repair, drain cleaning, emergency services and more.",
    rating: "4.8",
    reviews: "312 reviews",
  },
  {
    domain: "rapidrooter.com",
    title: "Rapid Rooter Co.",
    description: "Residential and commercial plumbing services.",
    rating: "4.7",
    reviews: "198 reviews",
  },
  {
    domain: "metropipeworks.com",
    title: "Metro Pipe Works",
    description: "Licensed plumbers serving the surrounding area.",
    rating: "4.6",
    reviews: "145 reviews",
  },
];

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
  | { status: "completed"; result: LookupResult };

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
    if (data.status === "completed") return { status: "completed", result: data.result };
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
    }, 16);
    return () => clearInterval(interval);
  }, [score]);
  return (
    <div className="relative w-[76px] h-[76px] shrink-0">
      <svg viewBox="0 0 76 76" className="w-full h-full -rotate-90">
        <circle cx="38" cy="38" r="32" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
        <circle
          cx="38"
          cy="38"
          r="32"
          fill="none"
          stroke="#ffffff"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={2 * Math.PI * 32}
          strokeDashoffset={2 * Math.PI * 32 * (1 - display / 100)}
          style={{ transition: "stroke-dashoffset 0.3s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[18px] font-bold text-white">
        {display}
      </div>
    </div>
  );
}

function FieldRow({ label, field }: { label: string; field: VerifiedField<string> }) {
  const icon =
    field.status === "confirmed" ? (
      <Check size={12} className="text-[#30D158]" />
    ) : field.status === "uncertain" ? (
      <AlertCircle size={12} className="text-[#FFD60A]" />
    ) : (
      <X size={12} className="text-[#FF453A]" />
    );
  return (
    <div className="flex items-center gap-2 text-[12px] text-white/70">
      {icon}
      <span className="text-white/45">{label}:</span>
      <span className="text-white/85 truncate">{field.value || "Not found"}</span>
    </div>
  );
}

function AiChatPanel() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [state, setState] = useState<LookupState>({ status: "idle" });
  const [stepIndex, setStepIndex] = useState(0);

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
    setState({ status: "researching" });
    const result = await runLookup(query, location);
    setState(result);
  }

  return (
    <div
      ref={ref}
      className={`ai-chat-panel${
        visible ? " is-visible" : ""
      } bg-[#111111] border border-white/[0.14] rounded-[24px] overflow-hidden min-h-[500px] shadow-[0_30px_100px_rgba(0,0,0,0.45)] flex flex-col`}
    >
      <div className="flex items-center justify-between h-[58px] px-[18px] border-b border-white/[0.08] shrink-0">
        <div className="flex items-center gap-2 text-[13px] font-medium text-white/80">
          <MessageSquare size={15} strokeWidth={1.75} />
          AI Assistant
        </div>
        <MoreHorizontal size={16} className="text-white/40" />
      </div>

      <div className="p-[22px] flex-1 flex flex-col">
        {state.status === "idle" && (
          <div className="ai-chat-fade flex flex-col flex-1" style={{ transitionDelay: "0.1s" }}>
            <div className="flex items-start gap-2.5 mb-5">
              <div className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                AI
              </div>
              <p className="text-[14px] leading-relaxed text-white/[0.82]">
                See how AI understands your business. Enter your business and
                we&apos;ll analyze the public information AI systems can find
                about you.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 pl-[38px]">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Business name, website, or social profile"
                className="h-[42px] rounded-[12px] bg-[#1a1a1a] border border-white/10 px-3.5 text-[13px] text-white placeholder:text-white/35 outline-none focus:border-white/25"
              />
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, State (optional)"
                className="h-[42px] rounded-[12px] bg-[#1a1a1a] border border-white/10 px-3.5 text-[13px] text-white placeholder:text-white/35 outline-none focus:border-white/25"
              />
              <button
                type="submit"
                className="h-[42px] rounded-[12px] bg-white text-black text-[13px] font-semibold flex items-center justify-center gap-1.5 hover:scale-[1.01] transition-transform"
              >
                Check My AI Presence
              </button>
            </form>
            <p className="mt-3 pl-[38px] text-[11px] text-white/30">
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
              <div className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                AI
              </div>
              <p className="text-[14px] leading-relaxed text-white/[0.82]">
                {state.message}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 pl-[38px]">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="yourbusiness.com or instagram.com/yourbusiness"
                className="h-[42px] rounded-[12px] bg-[#1a1a1a] border border-white/10 px-3.5 text-[13px] text-white placeholder:text-white/35 outline-none focus:border-white/25"
              />
              <button
                type="submit"
                className="h-[42px] rounded-[12px] bg-white text-black text-[13px] font-semibold"
              >
                Try Again
              </button>
            </form>
          </div>
        )}

        {state.status === "completed" && (
          <div className="ai-chat-fade flex-1 flex flex-col overflow-y-auto" style={{ transitionDelay: "0.05s" }}>
            <div className="flex items-center gap-1.5 text-[11px] text-white/40 mb-3">
              <Sparkles size={12} />
              SFB AI Presence Preview
            </div>

            <div className="flex items-center gap-3 p-3 rounded-[14px] bg-[#171717] border border-white/[0.08] mb-3">
              <ScoreDial score={state.result.scores.overall} />
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-white truncate">
                  {state.result.business.name.value || "Unknown business"}
                </div>
                <div className="text-[11px] text-white/45 truncate">
                  {state.result.business.website.value}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 mb-3">
              <FieldRow label="Phone" field={state.result.business.phone} />
              <FieldRow label="Location" field={state.result.business.location} />
              <FieldRow label="Category" field={state.result.business.category} />
            </div>

            {state.result.strengths.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] uppercase tracking-wide text-white/35 mb-1.5">
                  AI can clearly understand
                </div>
                {state.result.strengths.map((s) => (
                  <div key={s} className="flex items-start gap-1.5 text-[12px] text-white/70 mb-1">
                    <Check size={12} className="text-[#30D158] mt-[2px] shrink-0" />
                    {s}
                  </div>
                ))}
              </div>
            )}

            {state.result.gaps.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] uppercase tracking-wide text-white/35 mb-1.5">
                  AI may struggle with
                </div>
                {state.result.gaps.map((g) => (
                  <div key={g} className="flex items-start gap-1.5 text-[12px] text-white/70 mb-1">
                    <AlertCircle size={12} className="text-[#FFD60A] mt-[2px] shrink-0" />
                    {g}
                  </div>
                ))}
              </div>
            )}

            {state.result.missing.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] uppercase tracking-wide text-white/35 mb-1.5">
                  Unable to verify
                </div>
                {state.result.missing.map((m) => (
                  <div key={m} className="flex items-start gap-1.5 text-[12px] text-white/70 mb-1">
                    <X size={12} className="text-[#FF453A] mt-[2px] shrink-0" />
                    {m}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-1.5 flex-wrap mb-4">
              {state.result.sources.map((s) => (
                <span
                  key={s}
                  className="text-[10px] px-[9px] py-[5px] rounded-full bg-[#1A1A1A] border border-white/[0.08] text-white/[0.52] capitalize"
                >
                  {s}
                </span>
              ))}
            </div>

            <a
              href="#pricing"
              className="h-[42px] rounded-[12px] bg-white text-black text-[13px] font-semibold flex items-center justify-center gap-1.5 hover:scale-[1.01] transition-transform"
            >
              Get My Full AI Presence Audit
            </a>
            <button
              onClick={() => {
                setQuery("");
                setLocation("");
                setState({ status: "idle" });
              }}
              className="mt-2 h-[36px] text-[12px] text-white/45"
            >
              Check another business
            </button>
          </div>
        )}
      </div>

      {state.status === "idle" && (
        <div className="mx-[18px] mb-[18px] h-[46px] shrink-0 bg-[#1C1C1C] border border-white/10 rounded-[22px] flex items-center justify-between px-[14px] opacity-40 pointer-events-none">
          <span className="text-[12px] text-white/[0.34]">Ask a follow-up</span>
          <ArrowUp size={14} className="text-white/40" />
        </div>
      )}
    </div>
  );
}

export default function ShiftSection() {
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
            <div className="bg-[#0D0D0D] border border-white/[0.12] rounded-[24px] p-7 min-h-[500px] flex flex-col">
              <div className="font-mono text-[14px] text-white/45 mb-[22px]">
                2016
              </div>
              <div className="text-2xl font-semibold mb-7 leading-snug">
                &quot;best plumber near me&quot;
              </div>

              <div className="flex items-center gap-[7px] mb-4">
                <span className="w-[9px] h-[9px] rounded-full bg-[#5C5C5C]" />
                <span className="w-[9px] h-[9px] rounded-full bg-[#5C5C5C]" />
                <span className="w-[9px] h-[9px] rounded-full bg-[#5C5C5C]" />
                <div className="flex-1 h-[34px] bg-[#181818] rounded-[10px] flex items-center px-3 text-[12.5px] text-white/50 ml-2">
                  best plumber near me
                </div>
              </div>

              <div className="flex-1">
                {OLD_RESULTS.map((r) => (
                  <div
                    key={r.domain}
                    className="py-[18px] border-b border-white/[0.06] last:border-b-0"
                  >
                    <div className="text-[12px] text-white/45">
                      {r.domain}
                    </div>
                    <div className="text-[17px] font-medium text-[#D8D8D8] mt-1">
                      {r.title}
                    </div>
                    <div className="text-[13px] leading-relaxed text-white/[0.48] mt-1">
                      {r.description}
                    </div>
                    <div className="text-[12px] text-white/40 mt-1.5">
                      ★ {r.rating} · {r.reviews}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-[22px] text-[13px] text-white/[0.38] font-mono">
                Pages of links. The customer has to compare everything.
              </div>
            </div>

            <AiChatPanel />
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
