import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import StatusBadge from "@/components/agent/StatusBadge";
import AgentFaq from "@/components/agent/AgentFaq";
import AgentCheckout from "@/components/agent/AgentCheckout";
import { fetchAgentModules, roadmapPosition } from "@/lib/agentProgram/modules";
import { TIERS, CAPABILITIES, CREDIT_PRICES, TOP_UP_PACKS, FREE_ACTIONS, CREDITS_PER_BOOKED_CALL, CREDITS_PAY_FOR_WORK, DEMO_HREF, PRICING_NOTE, bookedCallsFor, fmtUsd } from "@/lib/agentProgram/config";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "SFB Agent — One agent. Eight jobs. You decide what it does.",
  description: "One AI agent per business with eight capabilities you toggle on and off, a human overseer who checks everything customer-facing, and credits that pay for work done. Free trial on a sample business.",
  alternates: { canonical: "/agent" },
  openGraph: { title: "Meet your SFB Agent", description: "One agent. Eight jobs. You decide what it does.", url: "/agent" },
};
const card: React.CSSProperties = { background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" };
const INTEGRATIONS = ["GoHighLevel", "Zapier", "Webhooks", "Google Calendar", "Gmail", "Meta", "Stripe"];

export default async function AgentPage() {
  const modules = await fetchAgentModules();
  const statusOf = (key: string) => modules.find((m) => m.key === key);
  const byCap = CAPABILITIES.map((c) => ({ cap: c, prices: CREDIT_PRICES.filter((p) => p.capability === c.key) }));

  return (
    <main className="bg-black text-white">
      <Navbar />
      <section className="pt-[150px] md:pt-[180px] pb-20 md:pb-28 px-6">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#30D158] mb-5">Meet your SFB Agent</div>
          <h1 className="text-[44px] sm:text-[60px] md:text-[80px] font-bold leading-[0.95] tracking-[-0.045em] max-w-[980px]">One agent. Eight jobs.{" "}<span className="font-serif-accent italic font-normal text-white/[0.86]">You decide what it does.</span></h1>
          <p className="mt-7 text-[17px] md:text-[20px] leading-[1.5] text-white/[0.6] max-w-[720px]">One AI agent assigned to your business. Toggle the eight things it can do. A human expert checks everything customer-facing. It runs on credits, and you always see the receipt.</p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/start" className="inline-flex items-center bg-white text-black px-6 py-3.5 rounded-full text-[14px] font-semibold hover:opacity-85 transition-opacity">Start free on a sample business →</Link>
            <Link href="#pricing" className="inline-flex items-center px-6 py-3.5 rounded-full text-[14px] font-medium text-white hover:bg-white/[0.05] transition-colors" style={{ border: "1px solid rgba(255,255,255,0.16)" }}>See pricing →</Link>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-24 px-6 section-band"><div className="max-w-[1100px] mx-auto">
        <h2 className="text-[30px] md:text-[40px] font-bold tracking-[-0.03em] mb-10">How it works</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[["1", "You get an agent.", "Assigned to your business on day one. It lives in your SFB login, where you watch everything it does."], ["2", "You switch on its jobs.", "Eight capabilities, each with an on/off toggle. Start with AI presence; add outbound, chat, ads, website, CRM, reviews and SOPs when you want them."], ["3", "A human checks the work.", "Nothing customer-facing ships without your overseer's approval. Every report is human-signed. Credits pay for work done, not outcomes."]].map(([n, t, d]) => (
            <div key={n} className="rounded-[14px] p-6" style={card}><div className="text-[12px] font-semibold text-white/[0.35] mb-3">Step {n}</div><div className="text-[19px] font-semibold tracking-[-0.02em] mb-2">{t}</div><p className="text-[13.5px] leading-[1.6] text-white/[0.55]">{d}</p></div>
          ))}
        </div>
      </div></section>

      <section id="capabilities" className="py-20 md:py-24 px-6 scroll-mt-24"><div className="max-w-[1100px] mx-auto">
        <h2 className="text-[30px] md:text-[40px] font-bold tracking-[-0.03em]">The eight capabilities</h2>
        <p className="mt-2 mb-10 text-[14px] text-white/[0.5]">Every tier gets all eight as they ship — tiers differ in credits and human support, not access. Shipping order can shift with demand.</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {CAPABILITIES.map((c, i) => { const m = statusOf(c.key); const pos = m ? roadmapPosition(modules, c.key) : null; return (
            <div key={c.key} className="rounded-[14px] p-5 flex flex-col gap-3" style={{ ...card, opacity: m?.status === "roadmap" ? 0.8 : 1 }}>
              <div className="flex items-start justify-between gap-2"><div className="text-[12px] font-semibold text-white/[0.35]">{i + 1}</div>{m && <StatusBadge status={m.status} size="xs" />}</div>
              <div className="text-[17px] font-semibold tracking-[-0.02em]">{c.name}</div>
              <p className="text-[13px] leading-[1.55] text-white/[0.55]">{c.short}</p>
              {m && m.status !== "live" && pos && <div className="text-[11px] text-white/[0.35] mt-auto pt-1">{pos === 1 ? "Next to unlock" : `#${pos} on the roadmap`}</div>}
            </div>); })}
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-2 text-[12.5px] text-white/[0.5]"><span className="mr-1">Works with</span>{INTEGRATIONS.map((n) => <span key={n} className="px-3 py-1 rounded-full" style={{ border: "1px solid rgba(255,255,255,0.12)" }}>{n}</span>)}</div>
      </div></section>

      <section id="credits" className="py-20 md:py-24 px-6 section-band scroll-mt-24"><div className="max-w-[1100px] mx-auto">
        <div className="grid md:grid-cols-[0.9fr_1.1fr] gap-10 md:gap-16 items-start">
          <div>
            <h2 className="text-[30px] md:text-[40px] font-bold tracking-[-0.03em]">What your credits buy</h2>
            <p className="mt-4 text-[15px] leading-[1.6] text-white/[0.55]">One credit type. Simple tasks cost little, big builds cost more, and every action shows its receipt in your dashboard.</p>
            <div className="mt-6 rounded-[12px] p-5" style={card}>
              <div className="text-[11px] uppercase tracking-wide text-white/[0.4] mb-2">Planning math</div>
              <div className="text-[14px] text-white/[0.75]">One fully-worked prospect — sourced, enriched, messaged, replied, booked — is about <span className="text-white font-semibold">{CREDITS_PER_BOOKED_CALL} credits</span>.</div>
              <ul className="mt-3 text-[13px] text-white/[0.55] flex flex-col gap-1">{TIERS.map((t) => <li key={t.key}><span className="text-white">{t.name}:</span> ≈ {bookedCallsFor(t.credits)} booked calls{t.monthlyUsd > 0 ? " / month" : ""}</li>)}</ul>
              <div className="mt-3 text-[12px] text-white/[0.4]">{CREDITS_PAY_FOR_WORK} Free (0 credits): {FREE_ACTIONS.join(", ").toLowerCase()}.</div>
            </div>
          </div>
          <div className="rounded-[12px] overflow-hidden" style={card}>
            {byCap.map(({ cap, prices }) => (
              <div key={cap.key} className="px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="text-[12px] font-semibold text-white/[0.8] mb-1.5">{cap.name}</div>
                <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-0.5">{prices.map((p) => <li key={p.key} className="flex justify-between text-[12.5px]"><span className="text-white/[0.55]">{p.label}</span><span className="tabular-nums text-white/[0.85]">{p.credits}</span></li>)}</ul>
              </div>
            ))}
            <div className="px-5 py-3"><ul className="grid sm:grid-cols-2 gap-x-6"><li className="flex justify-between text-[12.5px]"><span className="text-white/[0.55]">Human review pass</span><span className="tabular-nums text-white/[0.85]">{CREDIT_PRICES.find((p) => p.key === "human.review_pass")?.credits}</span></li></ul></div>
          </div>
        </div>
        <div className="mt-8 grid sm:grid-cols-3 gap-3">
          {TOP_UP_PACKS.map((p) => <div key={p.name} className="rounded-[12px] p-5 flex items-center justify-between" style={card}><div><div className="text-[15px] font-semibold">{p.name}</div><div className="text-[12px] text-white/[0.45]">Never expires while active</div></div><div className="text-[20px] font-bold tracking-[-0.03em]">{fmtUsd(p.usd)}</div></div>)}
        </div>
      </div></section>

      <section className="py-20 md:py-24 px-6"><div className="max-w-[1100px] mx-auto rounded-[18px] p-8 md:p-12 grid md:grid-cols-[1fr_1.2fr] gap-8 items-center" style={{ background: "#050505", border: "1px solid rgba(255,255,255,0.06)" }}>
        <h2 className="text-[30px] md:text-[40px] font-bold tracking-[-0.03em] leading-[1.05]">Every agent has a human.</h2>
        <p className="text-[15px] md:text-[16px] leading-[1.65] text-white/[0.6]">Don&apos;t trust AI with your business? Good — neither do we, unsupervised. A human expert reviews your agent&apos;s work, approves anything customer-facing, and signs every report. The agent does the work; the human makes sure it&apos;s right.</p>
      </div></section>

      <section id="pricing" className="py-20 md:py-24 px-6 section-band scroll-mt-24"><div className="max-w-[1100px] mx-auto">
        <h2 className="text-[30px] md:text-[40px] font-bold tracking-[-0.03em] mb-3">Pricing</h2>
        <p className="text-[14px] text-white/[0.5] mb-10">Start free on a sample business. Go live from {fmtUsd(TIERS[1].monthlyUsd)}/month.</p>
        <div className="grid md:grid-cols-3 gap-4">
          {TIERS.map((t, i) => { const featured = "featured" in t && t.featured; return (
            <div key={t.key} className="rounded-[16px] p-7 flex flex-col" style={{ ...card, borderColor: featured ? "rgba(48,209,88,0.45)" : "rgba(255,255,255,0.08)" }}>
              <div className="flex items-center justify-between"><div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-white/[0.5]">{t.name}</div>{featured && <span className="text-[10px] font-semibold uppercase tracking-wide text-[#30D158]">Most popular</span>}</div>
              <div className="mt-4 flex items-baseline gap-1.5"><span className="text-[40px] font-bold tracking-[-0.04em] leading-none">{t.monthlyUsd ? fmtUsd(t.monthlyUsd) : "Free"}</span>{t.monthlyUsd > 0 && <span className="text-[13px] text-white/[0.4]">/ month</span>}</div>
              {i > 0 && <div className="mt-3 text-[12px] text-white/[0.45]">Everything in {TIERS[i - 1].name}, plus…</div>}
              <dl className="mt-5 flex flex-col gap-2.5 text-[13.5px]">
                {[["Credits", t.creditsLabel], ["Businesses", t.businessesLabel], ["Capabilities", t.capabilitiesLabel], ["Integrations", t.integrations], ["Human overseer", t.overseer], ["Price list", t.priceListVisible ? "Visible" : "Spend shown, prices hidden"], ["Onboarding (one-time)", t.onboardingUsd ? fmtUsd(t.onboardingUsd) : "—"], ["Expiry", t.expiry]].map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="text-white/[0.5]">{k}</dt><dd className="font-medium text-right">{v}</dd></div>)}
              </dl>
              {t.monthlyUsd === 0 ? <Link href="/start" className="mt-8 inline-flex justify-center items-center px-5 py-3 rounded-full text-[13.5px] font-semibold text-white hover:bg-white/[0.05]" style={{ border: "1px solid rgba(255,255,255,0.16)" }}>Start free →</Link> : <AgentCheckout plan={t} />}
            </div>); })}
        </div>
        <div className="mt-8 rounded-[12px] px-5 py-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-[12.5px] text-white/[0.6]" style={card}><span>Cancel anytime</span><span>·</span><span>Month-to-month</span><span>·</span><span>No contracts</span><span>·</span><span>{CREDITS_PAY_FOR_WORK}</span></div>
        <p className="mt-4 text-[12px] text-white/[0.4]">{PRICING_NOTE} Prefer to talk first? <Link href={DEMO_HREF} className="underline underline-offset-2 text-white/[0.7]">Book a demo.</Link> Looking for AI Presence only? <Link href="/#pricing" className="underline underline-offset-2 text-white/[0.7]">Presence plans start at $19.99/month.</Link></p>
      </div></section>

      <section className="py-20 md:py-24 px-6"><div className="max-w-[1100px] mx-auto grid md:grid-cols-[0.8fr_1.2fr] gap-10"><h2 className="text-[30px] md:text-[40px] font-bold tracking-[-0.03em]">Questions</h2><AgentFaq /></div></section>
      <section className="pb-24 px-6"><div className="max-w-[1100px] mx-auto rounded-[18px] p-10 text-center" style={{ background: "#050505", border: "1px solid rgba(255,255,255,0.06)" }}><h2 className="text-[28px] md:text-[36px] font-bold tracking-[-0.03em]">Get your agent.</h2><p className="mt-3 text-[14px] text-white/[0.5]">Free on a sample business today. Live on yours when you&apos;re ready.</p><Link href="/start" className="mt-6 inline-flex items-center bg-white text-black px-6 py-3.5 rounded-full text-[14px] font-semibold hover:opacity-85">Start free →</Link></div></section>
      <Footer />
    </main>
  );
}
