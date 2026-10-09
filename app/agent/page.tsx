import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import StatusBadge from "@/components/agent/StatusBadge";
import AgentFaq from "@/components/agent/AgentFaq";
import { fetchAgentModules, roadmapPosition } from "@/lib/agentProgram/modules";
import { AGENT_PLANS, CREDIT_TIERS, DEMO_HREF, PRICING_NOTE, TOP_UP_FROM_USD, fmtUsd } from "@/lib/agentProgram/config";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "SFB Agent — Your business, run by an agent. Overseen by a human.",
  description: "One AI agent assigned to your business. It gets you found by AI, chats with your customers, follows up on every lead, runs your ads and documents your operations — with a human expert checking everything it does.",
  alternates: { canonical: "/agent" },
  openGraph: { title: "Meet your SFB Agent", description: "Your business, run by an agent. Overseen by a human.", url: "/agent" },
};

const card: React.CSSProperties = { background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" };

export default async function AgentPage() {
  const modules = await fetchAgentModules();
  const live = modules.filter((m) => m.status === "live").length;

  return (
    <main className="bg-black text-white">
      <Navbar />

      {/* Hero */}
      <section className="pt-[150px] md:pt-[180px] pb-20 md:pb-28 px-6">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#30D158] mb-5">Meet your SFB Agent</div>
          <h1 className="text-[44px] sm:text-[60px] md:text-[80px] font-bold leading-[0.95] tracking-[-0.045em] max-w-[980px]">
            Your business, run by an agent.{" "}
            <span className="font-serif-accent italic font-normal text-white/[0.86]">Overseen by a human.</span>
          </h1>
          <p className="mt-7 text-[17px] md:text-[20px] leading-[1.5] text-white/[0.6] max-w-[720px]">
            One AI agent assigned to your business. It gets you found by AI, chats with your customers, follows up on every lead, runs your ads, and documents your operations — with a human expert checking everything it does.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href={DEMO_HREF} className="inline-flex items-center bg-white text-black px-6 py-3.5 rounded-full text-[14px] font-semibold hover:opacity-85 transition-opacity">Meet your agent →</Link>
            <Link href="#modules" className="inline-flex items-center px-6 py-3.5 rounded-full text-[14px] font-medium text-white hover:bg-white/[0.05] transition-colors" style={{ border: "1px solid rgba(255,255,255,0.16)" }}>See what it unlocks →</Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 md:py-24 px-6 section-band">
        <div className="max-w-[1100px] mx-auto">
          <h2 className="text-[30px] md:text-[40px] font-bold tracking-[-0.03em] mb-10">How it works</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              ["1", "You get an agent.", "Assigned to your business on day one. It lives in your SFB login, where you watch everything it does."],
              ["2", "It starts with AI presence.", "First job: make sure AI recommends you — ChatGPT, Perplexity, Gemini, Claude. Found first, chosen first."],
              ["3", "It unlocks new abilities over time.", "Chat, follow-up automations, website, ads, operations docs — each new ability lights up in your dashboard with a report showing what changed. You buy the agent once; it keeps getting more capable."],
            ].map(([n, t, d]) => (
              <div key={n} className="rounded-[14px] p-6" style={card}>
                <div className="text-[12px] font-semibold text-white/[0.35] mb-3">Step {n}</div>
                <div className="text-[19px] font-semibold tracking-[-0.02em] mb-2">{t}</div>
                <p className="text-[13.5px] leading-[1.6] text-white/[0.55]">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="py-20 md:py-24 px-6 scroll-mt-24">
        <div className="max-w-[1100px] mx-auto">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <h2 className="text-[30px] md:text-[40px] font-bold tracking-[-0.03em]">The six modules</h2>
              <p className="mt-2 text-[14px] text-white/[0.5]">{live} live today. Roadmap order can shift with demand. Every unlock ships with a report.</p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((m) => {
              const pos = roadmapPosition(modules, m.key);
              const dim = m.status === "roadmap";
              return (
                <div key={m.key} className="rounded-[14px] p-6 flex flex-col gap-3 transition-colors" style={{ ...card, opacity: dim ? 0.78 : 1 }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-[12px] font-semibold text-white/[0.35]">Module {m.position}</div>
                    <StatusBadge status={m.status} />
                  </div>
                  <div className="text-[19px] font-semibold tracking-[-0.02em]">{m.name}</div>
                  <p className="text-[13.5px] leading-[1.6] text-white/[0.55]">{m.description}</p>
                  {m.status !== "live" && pos && <div className="text-[11.5px] text-white/[0.35] mt-auto pt-2">{pos === 1 ? "Next to unlock" : `${pos}${pos === 2 ? "nd" : pos === 3 ? "rd" : "th"} on the roadmap`}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Credits */}
      <section className="py-20 md:py-24 px-6 section-band">
        <div className="max-w-[1100px] mx-auto grid md:grid-cols-[0.9fr_1.1fr] gap-10 md:gap-16 items-start">
          <div>
            <h2 className="text-[30px] md:text-[40px] font-bold tracking-[-0.03em]">Credits — the fuel</h2>
            <p className="mt-4 text-[15px] leading-[1.6] text-white/[0.55]">Your agent runs on credits. Simple tasks cost little, big builds cost more — and you always see the receipt.</p>
            <p className="mt-4 text-[13.5px] text-white/[0.45]">Every plan includes monthly credits. Need more? Top up anytime — packs from {fmtUsd(TOP_UP_FROM_USD)}.</p>
          </div>
          <div className="flex flex-col gap-3">
            {CREDIT_TIERS.map((t) => (
              <div key={t.level} className="rounded-[12px] p-5 flex items-center gap-5" style={card}>
                <div className="shrink-0 w-[72px]">
                  <div className="text-[26px] font-bold tracking-[-0.03em] leading-none">{t.credits}</div>
                  <div className="text-[10.5px] uppercase tracking-wide text-white/[0.4] mt-1">credit{t.credits > 1 ? "s" : ""}</div>
                </div>
                <div>
                  <div className="text-[14px] font-semibold">{t.level}</div>
                  <div className="text-[13px] text-white/[0.5] mt-0.5">{t.examples}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Human */}
      <section className="py-20 md:py-24 px-6">
        <div className="max-w-[1100px] mx-auto rounded-[18px] p-8 md:p-12 grid md:grid-cols-[1fr_1.2fr] gap-8 items-center" style={{ background: "#050505", border: "1px solid rgba(255,255,255,0.06)" }}>
          <h2 className="text-[30px] md:text-[40px] font-bold tracking-[-0.03em] leading-[1.05]">Every agent has a human.</h2>
          <p className="text-[15px] md:text-[16px] leading-[1.65] text-white/[0.6]">
            Don&apos;t trust AI with your business? Good — neither do we, unsupervised. A human expert reviews your agent&apos;s work, approves anything customer-facing, and signs every report. The agent does the work; the human makes sure it&apos;s right.
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 md:py-24 px-6 section-band scroll-mt-24">
        <div className="max-w-[1100px] mx-auto">
          <h2 className="text-[30px] md:text-[40px] font-bold tracking-[-0.03em] mb-3">Pricing</h2>
          <p className="text-[14px] text-white/[0.5] mb-10">Every tier unlocks all six modules as they ship — tiers differ in credits and human support, not access.</p>
          <div className="grid md:grid-cols-3 gap-4">
            {AGENT_PLANS.map((p) => (
              <div key={p.key} className="rounded-[16px] p-7 flex flex-col" style={{ ...card, borderColor: "featured" in p && p.featured ? "rgba(48,209,88,0.45)" : "rgba(255,255,255,0.08)" }}>
                <div className="flex items-center justify-between">
                  <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-white/[0.5]">{p.name}</div>
                  {"featured" in p && p.featured && <span className="text-[10px] font-semibold uppercase tracking-wide text-[#30D158]">Most chosen</span>}
                </div>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-[40px] font-bold tracking-[-0.04em] leading-none">{fmtUsd(p.monthlyUsd)}</span>
                  <span className="text-[13px] text-white/[0.4]">/ month</span>
                </div>
                <dl className="mt-7 flex flex-col gap-3 text-[13.5px]">
                  <div className="flex justify-between gap-4"><dt className="text-white/[0.5]">Credits / mo</dt><dd className="font-semibold">{p.creditsPerMonth}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-white/[0.5]">Human overseer</dt><dd className="font-semibold">{p.overseer}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-white/[0.5]">Onboarding (one-time)</dt><dd className="font-semibold">{fmtUsd(p.onboardingUsd)}</dd></div>
                </dl>
                <Link href={DEMO_HREF} className="mt-8 inline-flex justify-center items-center bg-white text-black px-5 py-3 rounded-full text-[13.5px] font-semibold hover:opacity-85 transition-opacity">Get your agent →</Link>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[12px] text-white/[0.4]">{PRICING_NOTE} Looking for AI Presence only? <Link href="/#pricing" className="underline underline-offset-2 text-white/[0.7]">Presence plans start at $19.99/month.</Link></p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 md:py-24 px-6">
        <div className="max-w-[1100px] mx-auto grid md:grid-cols-[0.8fr_1.2fr] gap-10">
          <h2 className="text-[30px] md:text-[40px] font-bold tracking-[-0.03em]">Questions</h2>
          <AgentFaq />
        </div>
      </section>

      <Footer />
    </main>
  );
}
