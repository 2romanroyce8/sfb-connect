"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown, Loader2 } from "lucide-react";
import { useBusinessLookup } from "@/lib/businessLookupContext";
import { runBusinessLookup } from "@/lib/runBusinessLookup";

export default function Hero() {
  const { setLookupResult } = useBusinessLookup();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;
    setLoading(true);
    setError(null);
    const outcome = await runBusinessLookup(query);
    setLoading(false);

    if (outcome.status === "completed") {
      setLookupResult(outcome.result, outcome.summary);
      document.getElementById("shift")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (outcome.status === "needs_link") {
      setError(outcome.message);
    } else {
      setError(outcome.message);
    }
  }

  return (
    <section className="relative min-h-[100svh] w-full overflow-hidden flex flex-col items-center justify-center text-center px-6 pt-[120px] pb-[72px]">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_120549_0cd82c36-56b3-4dd9-b190-069cfc3a623f.mp4"
      />
      {/* Layered readability overlay — background art stays fully intact underneath */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.44) 0%, rgba(0,0,0,0.18) 30%, rgba(0,0,0,0.20) 62%, rgba(0,0,0,0.48) 100%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 43%, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.18) 58%, rgba(0,0,0,0.36) 100%)",
        }}
      />
      {/* Smooth fade into the next section — no blur/opacity on the media itself */}
      <div
        className="absolute inset-x-0 bottom-0 h-[140px] pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.5) 60%, #000000 100%)",
        }}
      />

      <div className="relative z-10 w-full max-w-[1120px] mx-auto flex flex-col items-center md:-translate-y-3">
        <span
          className="mb-5 text-[11px] font-semibold tracking-[0.24em] uppercase text-white/[0.62]"
          style={{ textShadow: "0 1px 14px rgba(0,0,0,0.55)" }}
        >
          AI Presence for Business
        </span>

        <h1
          className="text-[56px] sm:text-[72px] md:text-[92px] font-bold leading-[0.9] tracking-[-0.055em] max-w-[1050px]"
          style={{ textShadow: "0 3px 30px rgba(0,0,0,0.32)" }}
        >
          Your customers are asking AI
          <br />
          who to{" "}
          <span className="font-serif-accent italic font-normal">
            choose.
          </span>
        </h1>

        <div
          className="mt-[22px] text-[28px] sm:text-[32px] md:text-[38px] font-medium tracking-[-0.035em] text-white"
          style={{ textShadow: "0 2px 20px rgba(0,0,0,0.45)" }}
        >
          Make sure it can find you.
        </div>

        <p
          className="max-w-[690px] mt-[22px] text-[17px] leading-relaxed text-white/[0.86]"
          style={{ textShadow: "0 2px 18px rgba(0,0,0,0.55)" }}
        >
          See how clearly AI can understand your business, what it can
          verify, and what may be keeping you from being recommended.
        </p>

        <div className="w-full max-w-[650px] mt-[34px]">
          <div className="mb-[9px] text-[9px] font-semibold tracking-[0.16em] text-white/[0.48] text-left pl-1">
            LIVE BUSINESS LOOKUP
          </div>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 sm:grid-cols-[1fr_auto] items-center gap-1.5 p-[6px] min-h-[64px] rounded-[18px] border border-white/30"
            style={{
              background: "rgba(7,7,7,0.52)",
              backdropFilter: "blur(18px) saturate(120%)",
              WebkitBackdropFilter: "blur(18px) saturate(120%)",
              boxShadow:
                "0 16px 55px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <input
              type="text"
              required
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Business name, website, or social profile"
              className="h-[52px] bg-transparent border-none outline-none px-[18px] text-[14px] text-white placeholder:text-white/[0.48]"
            />
            <button
              type="submit"
              disabled={loading}
              className="h-[52px] px-[25px] rounded-[13px] bg-white text-[#080808] text-[12px] font-bold tracking-[-0.01em] inline-flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-60 whitespace-nowrap"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  Analyze My Business
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
          {error && (
            <p className="text-sm text-red-300 mt-3">{error}</p>
          )}
        </div>

        <div className="mt-[15px] flex items-center justify-center gap-2 text-[11px] text-white/[0.62] flex-wrap max-w-[320px] sm:max-w-none">
          <span>Public business data only</span>
          <span>•</span>
          <span>No login required to preview</span>
          <span>•</span>
          <span>Takes about 30 seconds</span>
        </div>

        <div className="mt-[26px] flex items-baseline justify-center gap-[10px]">
          <span className="text-[19px] font-semibold text-white">$200</span>
          <span className="text-[13px] font-semibold tracking-[0.08em] text-white/[0.86]">
            / YEAR
          </span>
          <span className="text-[12px] text-white/[0.62]">
            Full annual AI Presence service
          </span>
        </div>
      </div>

      <div className="absolute bottom-[26px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-[7px] z-10">
        <span className="text-[9px] tracking-[0.12em] uppercase text-white/[0.42]">
          See how it works
        </span>
        <ChevronDown size={15} className="text-white/[0.52]" />
      </div>
    </section>
  );
}
