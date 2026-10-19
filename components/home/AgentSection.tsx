import Link from "next/link";
import { CAPABILITIES } from "@/lib/agentProgram/config";
import IntegrationsStrip from "@/components/home/IntegrationsStrip";
import CapabilityCardLink from "@/components/home/CapabilityCardLink";


// #agent -- the 8 capability cards, the human band and the integrations row.
// No statuses here (Roman, 2026-10-15); they live on /agent and the dashboards. The walkthrough video lives ONLY in ShowcaseVideo at the top of
// the page (Roman, 2026-10-15: "don't need the video here anymore").
export default function AgentSection() {
  return (
    <section id="agent" className="py-20 md:py-28 px-6 scroll-mt-24" style={{ background: "var(--hx-000000)" }}>
      <div className="max-w-[1180px] mx-auto">
        <div className="max-w-[760px] mb-12">
          <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-5 block">Meet your SFB Agent</span>
          <h2 className="text-[32px] sm:text-[40px] md:text-[56px] font-extrabold tracking-[-0.025em] leading-[1.06]">One agent. Eight jobs. <span className="font-serif-accent italic font-normal">You decide what it does.</span></h2>
          <p className="mt-5 text-[17px] leading-relaxed text-[color:var(--hx-a3a3a8)] max-w-[640px]">Your SFB Agent is assigned to your business on day one and plugs into the tools you already use — GoHighLevel, Zapier, Google Calendar, Gmail, Meta. Flip any capability on or off in one click: your plan sets your credits and human support, never which jobs your agent can do.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Roman, 2026-10-15: no status pills or roadmap lines on the homepage cards — just the eight jobs. Statuses still show on /agent and in the dashboards. */}
          {CAPABILITIES.map((c, i) => (
            <CapabilityCardLink key={c.key} capabilityKey={c.key}>
              <div className="text-[12px] font-semibold text-white/[0.35]">{String(i + 1).padStart(2, "0")}</div>
              <div className="text-[17px] font-semibold tracking-[-0.02em] mt-3">{c.name}</div>
              <p className="text-[13px] leading-[1.55] text-white/[0.55] mt-1.5">{c.short}</p>
            </CapabilityCardLink>
          ))}
        </div>

        <div className="mt-10">
          <div className="rounded-[16px] p-6 md:p-8 flex flex-col justify-center" style={{ background: "var(--hx-050505)", border: "1px solid rgb(var(--w) / 0.06)" }}>
            <h3 className="text-[26px] md:text-[32px] font-bold tracking-[-0.03em] leading-[1.05]">Every agent has a human.</h3>
            <p className="mt-4 text-[14.5px] leading-[1.65] text-white/[0.6]">Don&apos;t trust AI with your business? Good — neither do we, unsupervised. A human expert reviews your agent&apos;s work, approves anything customer-facing, and signs every report.</p>
            <div className="mt-6 flex flex-wrap gap-3"><Link href="/start" className="inline-flex items-center bg-white text-black px-5 py-3 rounded-full text-[13.5px] font-semibold hover:opacity-85">Get started →</Link></div>
        <IntegrationsStrip compact />
          </div>
        </div>
      </div>
    </section>
  );
}
