"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Check, Loader2 } from "lucide-react";

// Premium "Book a Demo" form for SFB Connect — POSTs to the real
// /api/demo-requests endpoint, which saves a genuine demo_requests row and
// best-effort kicks off real business research from the link provided.
// No step here fakes a sent email/SMS or a completed report; the success
// state only ever describes what has actually happened.
export default function DemoBookingForm() {
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [businessLink, setBusinessLink] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);

  // The success card is much shorter than the form it replaces. Without
  // this, the viewport's scroll offset stays fixed in place, and the user
  // ends up scrolled past the (now much shorter) confirmation instead of
  // looking at it -- they'd have to manually scroll back up to see "You're
  // all set." Center it in view instead, and move focus there too.
  useEffect(() => {
    if (status !== "done") return;
    const t = setTimeout(() => {
      confirmationRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      confirmationRef.current?.focus();
    }, 50);
    return () => clearTimeout(t);
  }, [status]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !companyName.trim() || !businessLink.trim() || !email.trim() || !phone.trim()) {
      setError("Please fill in every field.");
      return;
    }
    if (!consent) {
      setError("Please confirm you agree to be contacted.");
      return;
    }
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/demo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, companyName, businessLink, email, phone, consent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="relative w-full max-w-[590px] mx-auto">
      {/* hanging ribbon accent */}
      <div
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none z-0"
        style={{
          top: "-104px",
          width: 82,
          height: 128,
          background: "linear-gradient(180deg, #4B37FF 0%, #2920D8 100%)",
          clipPath: "polygon(18% 0, 82% 0, 100% 100%, 0 100%)",
          opacity: 0.9,
        }}
      />
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full z-[1]"
        style={{
          top: "12px",
          width: 104,
          height: 20,
          background: "#0D0D0D",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      />

      <div
        className="relative z-[2] rounded-[26px] px-7 sm:px-10 pt-12 pb-9"
        style={{
          background: "linear-gradient(180deg, #171717 0%, #141414 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 28px 80px rgba(0,0,0,0.34)",
        }}
      >
        {status === "done" ? (
          <div ref={confirmationRef} tabIndex={-1} className="text-center py-9 px-2 outline-none">
            <CheckCircle2 size={46} className="text-[#30D158] mx-auto" strokeWidth={1.5} />
            <div className="text-[28px] sm:text-[31px] font-semibold tracking-[-0.02em] text-[#F5F5F7] mt-4">
              You&apos;re all set.
            </div>
            <p className="mt-3 text-[15px] sm:text-[16px] leading-relaxed text-[#A1A1A6] max-w-[420px] mx-auto">
              We&apos;re preparing your free AI Presence progress report now.
              Check your email and phone shortly for your report and next
              steps to schedule your demo.
            </p>
            <p className="mt-3.5 text-[13px] text-[#6E6E73]">
              Most confirmations arrive within a few minutes.
            </p>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="inline-flex items-center mt-6 text-[13px] text-white/60 border border-white/15 rounded-full px-5 h-9 hover:text-white hover:border-white/30 transition-colors"
            >
              Return to SFB Connect
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-[22px]">
            <div>
              <div className="text-[30px] sm:text-[38px] font-semibold tracking-[-0.04em] text-[#F5F5F7]">
                Book Your Demo
              </div>
              <p className="mt-3.5 text-[15px] sm:text-[17px] leading-relaxed text-[#A1A1A6]">
                Tell us about your business and we&apos;ll prepare a free AI
                Presence progress report before your demo.
              </p>
            </div>

            <DemoField label="Full Name">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                className="demo-field"
              />
            </DemoField>

            <DemoField label="Company Name">
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Business name"
                autoComplete="organization"
                className="demo-field"
              />
            </DemoField>

            <DemoField label="Website or Social Media">
              <input
                value={businessLink}
                onChange={(e) => setBusinessLink(e.target.value)}
                placeholder="Website, Facebook, Instagram, TikTok, LinkedIn, etc."
                className="demo-field"
              />
            </DemoField>

            <DemoField label="Email Address">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                className="demo-field"
              />
            </DemoField>

            <DemoField label="Phone Number">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 555-5555"
                autoComplete="tel"
                className="demo-field"
              />
            </DemoField>

            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <span
                className="relative mt-[1px] w-[18px] h-[18px] rounded-[5px] shrink-0 flex items-center justify-center"
                style={{ background: "#242424", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  aria-label="I agree to be contacted by SFB Connect about my demo request and progress report."
                />
                {consent && <Check size={12} className="text-white" strokeWidth={3} />}
              </span>
              <span className="text-[13px] leading-[1.45] text-[#A1A1A6]">
                I agree to be contacted by SFB Connect about my demo request
                and progress report.
              </span>
            </label>

            {error && <p className="text-[12.5px] text-[#FF6B6B] -mt-2">{error}</p>}

            <button
              type="submit"
              disabled={status === "submitting"}
              className="w-full h-[60px] sm:h-[66px] rounded-[12px] text-white text-[16px] sm:text-[18px] font-semibold flex items-center justify-center gap-2 transition-[filter] hover:brightness-110 disabled:opacity-70 mt-1"
              style={{
                background: "linear-gradient(180deg, #4A38FF 0%, #2F24F4 100%)",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "0 10px 24px rgba(57,43,255,0.20)",
              }}
            >
              {status === "submitting" && <Loader2 size={16} className="animate-spin" />}
              {status === "submitting" ? "Preparing your request..." : "Get My Free Report + Book Demo"}
            </button>

            <p className="text-[12px] leading-relaxed text-[#6E6E73] text-center -mt-2">
              We&apos;ll use the business information you provide to prepare
              your initial AI Presence research.
            </p>
          </form>
        )}
      </div>

      <style jsx>{`
        :global(.demo-field) {
          width: 100%;
          height: 58px;
          background: #242424;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 13px;
          padding: 0 16px;
          font-size: 15px;
          color: #f5f5f7;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        :global(.demo-field::placeholder) {
          color: #8a8a8f;
        }
        :global(.demo-field:focus) {
          border-color: rgba(92, 76, 255, 0.72);
          box-shadow: 0 0 0 3px rgba(74, 58, 255, 0.09);
        }
        @media (min-width: 640px) {
          :global(.demo-field) {
            height: 64px;
          }
        }
      `}</style>
    </div>
  );
}

function DemoField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block mb-2.5 text-[14px] sm:text-[15px] font-medium text-[#F5F5F7]">{label}</label>
      {children}
    </div>
  );
}
