import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";
import ServiceInquiryForm from "@/components/marketing/ServiceInquiryForm";

export const metadata: Metadata = {
  title: "Websites",
  description:
    "SFB Connect designs, rebuilds, and develops websites that communicate a business clearly to customers while providing the technical structure modern search and AI-assisted discovery systems can interpret.",
};

// ─── Service path data ───────────────────────────────────────────────────────

const SERVICE_PATHS = [
  {
    number: "01",
    id: "rebuild",
    label: "Website Rebuild",
    tagline: "For businesses that already have a website but need something substantially better.",
    items: [
      "Visual redesign",
      "UX improvement",
      "Mobile optimization",
      "Conversion improvements",
      "Content restructuring",
      "Technical cleanup",
      "Service architecture",
      "Structured data",
      "Machine readability",
      "AI Presence integration",
    ],
  },
  {
    number: "02",
    id: "custom",
    label: "Build From Scratch",
    tagline: "For businesses that need an entirely new digital presence.",
    items: [
      "Strategy",
      "Information architecture",
      "UI/UX design",
      "Custom development",
      "Mobile responsive implementation",
      "Service/product architecture",
      "Contact and conversion systems",
      "Analytics and integration readiness",
      "Structured business data",
      "AI Presence foundations",
    ],
  },
  {
    number: "03",
    id: "ai-presence-website",
    label: "AI Presence + Website",
    tagline: "The complete digital foundation.",
    description:
      "Build or rebuild the website while simultaneously improving how clearly the business is represented for AI-assisted discovery. This is the most complete starting point — a single coordinated project that addresses both the customer-facing website and the underlying business signals that AI systems rely on.",
    items: [
      "Everything in Rebuild or Build From Scratch",
      "AI Presence audit and optimization",
      "Entity and business identity clarity",
      "Knowledge optimization",
      "Structured data implementation",
      "Machine-readable service architecture",
      "Ongoing annual AI Presence review",
    ],
    note: "AI recommendations are dynamic and depend on many external factors. This service improves the clarity and technical structure of how a business is represented — it does not guarantee a specific ranking or recommendation outcome.",
    featured: true,
  },
];

// ─── Before / After data ─────────────────────────────────────────────────────

const BEFORE = [
  "Outdated visual design",
  "Unclear services and offerings",
  "Poor mobile experience",
  "Weak or missing conversion path",
  "Fragmented business information",
  "Limited machine-readable structure",
];

const AFTER = [
  "Modern, purposeful interface",
  "Clear services and value proposition",
  "Mobile optimized",
  "Strong conversion path",
  "Consistent business information",
  "Structured technical foundation",
  "AI Presence integrated",
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WebsitesPage() {
  return (
    <>
      <Navbar />

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section
        id="hero"
        className="relative w-full overflow-hidden flex flex-col items-center justify-center text-center px-6 pt-[120px] pb-[96px] min-h-[88svh]"
        style={{ background: "#000000" }}
      >
        {/* Subtle radial glow — not a gradient orb, just depth */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(255,255,255,0.032) 0%, transparent 70%)",
          }}
        />
        {/* Bottom fade to next section */}
        <div
          className="absolute inset-x-0 bottom-0 h-[100px] pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 80%, #000 100%)",
          }}
        />

        <div className="relative z-10 w-full max-w-[1040px] mx-auto flex flex-col items-center">
          <Reveal>
            <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-8 block">
              Websites / SFB Connect
            </span>

            <h1 className="text-[52px] sm:text-[68px] md:text-[88px] font-bold leading-[0.94] tracking-[-0.05em] text-white max-w-[900px]">
              Your website shouldn&apos;t just{" "}
              <span className="font-serif-accent italic font-normal">
                look good.
              </span>
              <br />
              It should understand its job.
            </h1>

            <div className="mt-8 font-mono text-xs tracking-[0.22em] uppercase text-medium-gray">
              Built for people. Structured for machines.
            </div>

            <p className="mt-7 max-w-[620px] mx-auto text-[17px] leading-relaxed text-white/60">
              SFB Connect designs, rebuilds and develops websites that
              communicate a business clearly to customers while providing the
              technical structure modern search and AI-assisted discovery systems
              can interpret.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#inquiry"
                className="inline-flex items-center gap-2 h-[50px] px-7 rounded-[8px] bg-white text-black text-[14px] font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                Build My Website
                <ArrowRight size={14} />
              </a>
              <Link
                href="/portfolio"
                className="inline-flex items-center gap-2 h-[50px] px-7 rounded-[8px] text-white text-[14px] font-medium transition-colors"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.11)",
                }}
              >
                View Our Work
              </Link>
            </div>

            <p className="mt-10 text-[11.5px] text-white/30 max-w-[420px] mx-auto">
              Website projects are custom-quoted based on scope — request a
              quote below.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Service Paths ───────────────────────────────────────────────────── */}
      <section className="py-24 md:py-32 px-6" style={{ background: "#000" }}>
        <div className="max-w-[1180px] mx-auto">
          <Reveal>
            <SectionHead
              label="What We Build"
              title={
                <>
                  Three ways to get{" "}
                  <span className="font-serif-accent italic font-normal">
                    started.
                  </span>
                </>
              }
              description="Whether you have an existing site that needs work or you're starting from nothing, there's a clear path forward."
            />
          </Reveal>

          <div className="flex flex-col gap-px mt-4" style={{ background: "rgba(255,255,255,0.07)" }}>
            {SERVICE_PATHS.map((s) => (
              <Reveal key={s.id}>
                <div
                  id={s.id}
                  className="relative px-0 py-12 md:py-16"
                  style={{ background: "#000" }}
                >
                  {s.featured && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          "radial-gradient(ellipse 60% 80% at 10% 50%, rgba(255,255,255,0.015) 0%, transparent 70%)",
                      }}
                    />
                  )}

                  <div className="grid md:grid-cols-[120px_1fr_340px] gap-6 md:gap-10 items-start relative z-10">
                    {/* Number */}
                    <div className="font-mono text-[13px] text-white/20 pt-1">
                      {s.number}
                    </div>

                    {/* Main */}
                    <div>
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <h2 className="text-[28px] md:text-[38px] font-bold tracking-[-0.03em] text-white leading-[1.05]">
                          {s.label}
                        </h2>
                        {s.featured && (
                          <span
                            className="inline-flex items-center h-[20px] px-[9px] rounded-full text-[8px] font-semibold tracking-[0.08em] uppercase text-white/70"
                            style={{
                              background: "rgba(255,255,255,0.09)",
                              border: "1px solid rgba(255,255,255,0.13)",
                            }}
                          >
                            Recommended
                          </span>
                        )}
                      </div>

                      <p className="text-[15px] text-white/50 mb-5 max-w-[540px] leading-relaxed">
                        {s.tagline}
                      </p>

                      {s.description && (
                        <p className="text-[14px] text-white/38 max-w-[560px] leading-relaxed mb-5">
                          {s.description}
                        </p>
                      )}

                      {s.note && (
                        <p className="mt-4 text-[11px] text-white/25 max-w-[540px] leading-relaxed border-l border-white/10 pl-3">
                          {s.note}
                        </p>
                      )}
                    </div>

                    {/* Items */}
                    <div className="flex flex-col gap-2">
                      {s.items.map((item) => (
                        <div
                          key={item}
                          className="flex items-center gap-2.5 text-[12.5px] text-white/50"
                        >
                          <Check
                            size={12}
                            strokeWidth={2}
                            className="shrink-0 text-white/30"
                          />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="mt-9 text-center">
              <p className="text-[13px] text-white/30">
                Website projects are custom-quoted based on scope.{" "}
                <a href="#inquiry" className="text-white/55 underline underline-offset-2 hover:text-white/80 transition-colors">
                  Request a quote below.
                </a>
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Before / After ──────────────────────────────────────────────────── */}
      <section
        className="py-24 md:py-32 px-6"
        style={{ background: "#080808" }}
      >
        <div className="max-w-[1180px] mx-auto">
          <Reveal>
            <SectionHead
              label="What Changes"
              title={
                <>
                  Before and{" "}
                  <span className="font-serif-accent italic font-normal">
                    after.
                  </span>
                </>
              }
              description="A conceptual illustration of what a website project addresses — not a specific client comparison."
            />
          </Reveal>

          <Reveal>
            <div
              className="mt-2 mb-8 text-[11px] text-white/25 max-w-[540px] border-l border-white/10 pl-3"
            >
              The following is a descriptive comparison of common starting
              conditions and what changes through a website project. It does
              not represent before/after screenshots from any actual client
              project.
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-px" style={{ background: "rgba(255,255,255,0.07)" }}>
            {/* Before */}
            <Reveal>
              <div
                className="p-8 md:p-12"
                style={{ background: "#0a0a0a" }}
              >
                <div className="font-mono text-xs tracking-[0.18em] uppercase text-white/25 mb-8">
                  Before
                </div>
                <div className="flex flex-col gap-4">
                  {BEFORE.map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}
                      >
                        <X size={10} strokeWidth={2} className="text-white/30" />
                      </div>
                      <span className="text-[14px] text-white/40">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* After */}
            <Reveal>
              <div
                className="p-8 md:p-12"
                style={{ background: "#0d0d0d" }}
              >
                <div className="font-mono text-xs tracking-[0.18em] uppercase text-white/40 mb-8">
                  After SFB Connect
                </div>
                <div className="flex flex-col gap-4">
                  {AFTER.map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.16)" }}
                      >
                        <Check size={10} strokeWidth={2.5} className="text-white/70" />
                      </div>
                      <span className="text-[14px] text-white/70">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Cross-sell: AI Presence ──────────────────────────────────────────── */}
      <section className="py-24 md:py-32 px-6" style={{ background: "#000" }}>
        <div className="max-w-[1180px] mx-auto">
          <div
            className="rounded-[16px] p-10 md:p-16"
            style={{
              background: "#0d0d0d",
              border: "1px solid rgba(255,255,255,0.09)",
            }}
          >
            <Reveal>
              <div className="max-w-[700px]">
                <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-5 block">
                  Add-On
                </span>
                <h2 className="text-[32px] sm:text-[42px] md:text-[52px] font-bold tracking-[-0.035em] leading-[1.05] text-white mb-6">
                  Built with{" "}
                  <span className="font-serif-accent italic font-normal">
                    AI Presence
                  </span>{" "}
                  in mind.
                </h2>
                <p className="text-[16px] text-white/50 leading-relaxed mb-8 max-w-[560px]">
                  AI Presence can be added to any website project. While the
                  website handles the customer-facing experience, AI Presence
                  addresses the underlying signals — structured data, entity
                  clarity, machine-readable business information — that
                  AI-assisted discovery systems rely on. The two are designed
                  to work together.
                </p>
                <Link
                  href="/#score"
                  className="inline-flex items-center gap-2 h-[50px] px-7 rounded-[8px] bg-white text-black text-[14px] font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform"
                >
                  Add AI Presence
                  <ArrowRight size={14} />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Inquiry / Lead Capture ───────────────────────────────────────────── */}
      <section
        id="inquiry"
        className="py-24 md:py-32 px-6"
        style={{ background: "#080808" }}
      >
        <div className="max-w-[1180px] mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-5 block">
                Get Started
              </span>
              <h2 className="text-[36px] sm:text-[48px] md:text-[60px] font-bold tracking-[-0.04em] leading-[1.05] text-white">
                Start your website{" "}
                <span className="font-serif-accent italic font-normal">
                  project.
                </span>
              </h2>
              <p className="mt-5 text-[16px] text-white/50 max-w-[480px] mx-auto leading-relaxed">
                Tell us about your business and what you need. We&apos;ll follow
                up with a custom quote.
              </p>
            </div>
          </Reveal>

          <Reveal>
            <div className="max-w-[560px] mx-auto">
              <ServiceInquiryForm
                defaultInterest="New Website"
                ctaLabel="Build My Website"
                title="Tell us about your business"
              />
            </div>
          </Reveal>
        </div>
      </section>

      <Footer />
    </>
  );
}
