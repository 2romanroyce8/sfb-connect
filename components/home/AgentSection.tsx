import Link from "next/link";
import { fetchAgentModules, roadmapPosition } from "@/lib/agentProgram/modules";
import { CAPABILITIES } from "@/lib/agentProgram/config";
import StatusBadge from "@/components/agent/StatusBadge";
import CapabilityCardLink from "@/components/home/CapabilityCardLink";

const INTEGRATIONS = ["GoHighLevel", "Zapier", "Webhooks", "Google Calendar", "Gmail"];

// #agent -- the 8 capability cards, the integrations row, the human band and
// the demo-video slot. Statuses come from agent_program_modules (same rows
// as /agent and every dashboard). No mockups: the video slot is an honest
// placeholder until a real screen recording exists.
export default async function AgentSection() {
  const modules = await fetchAgentModules();
  const statusOf = (key: string) => modules.find((m) => m.key === key);
  return (
    <section id="agent" className="py-20 md:py-28 px-6 scroll-mt-24" style={{ background: "#000" }}>
      <div className="max-w-[1180px] mx-auto">
        <div className="max-w-[760px] mb-12">
          <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-5 block">Meet your SFB Agent</span>
          <h2 className="text-[32px] sm:text-[40px] md:text-[56px] font-extrabold tracking-[-0.025em] leading-[1.06]">One agent. Eight jobs. <span className="font-serif-accent italic font-normal">You decide what it does.</span></h2>
          <p className="mt-5 text-[17px] leading-relaxed text-[#a3a3a8] max-w-[640px]">Your SFB Agent is assigned to your business on day one and plugs into the tools you already use — GoHighLevel, Zapier, Google Calendar, Gmail, Meta. Flip any capability on or off in one click: your plan sets your credits and human support, never which jobs your agent can do.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {CAPABILITIES.map((c, i) => { const m = statusOf(c.key); const pos = m ? roadmapPosition(modules, c.key) : null; return (
            <CapabilityCardLink key={c.key} capabilityKey={c.key}>
              <div className="flex items-start justify-between gap-2"><div className="text-[12px] font-semibold text-white/[0.35]">{String(i + 1).padStart(2, "0")}</div>{m && <StatusBadge status={m.status} size="xs" />}</div>
              <div className="text-[17px] font-semibold tracking-[-0.02em] mt-3">{c.name}</div>
              <p className="text-[13px] leading-[1.55] text-white/[0.55] mt-1.5">{c.short}</p>
              {m && m.status !== "live" && pos && <div className="text-[11px] text-white/[0.35] mt-3">{pos === 1 ? "Next to unlock" : `#${pos} on the roadmap`}</div>}
            </CapabilityCardLink>); })}
        </div>

        <div className="mt-10 grid lg:grid-cols-[1.1fr_0.9fr] gap-4">
          <div className="rounded-[16px] p-6 md:p-8 flex flex-col justify-between" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div>
              <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-white/[0.4] mb-3">Watch it work</div>
              <div className="aspect-video rounded-[12px] flex items-center justify-center text-center p-6" style={{ background: "#050505", border: "1px dashed rgba(255,255,255,0.14)" }}>
                <div><div className="text-[15px] font-semibold text-white/[0.85]">Demo recording coming</div><div className="text-[12.5px] text-white/[0.45] mt-1.5 max-w-[380px]">A real screen recording of the agent enriching a prospect, writing the message and booking the call — not a mockup. Until it exists, there&apos;s nothing to show you here.</div></div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-[12.5px] text-white/[0.5]"><span className="mr-1">Plugs into your stack, no rip-and-replace:</span>{INTEGRATIONS.map((n) => <span key={n} className="px-3 py-1 rounded-full" style={{ border: "1px solid rgba(255,255,255,0.12)" }}>{n}</span>)}</div>
          </div>
          <div className="rounded-[16px] p-6 md:p-8 flex flex-col justify-center" style={{ background: "#050505", border: "1px solid rgba(255,255,255,0.06)" }}>
            <h3 className="text-[26px] md:text-[32px] font-bold tracking-[-0.03em] leading-[1.05]">Every agent has a human.</h3>
            <p className="mt-4 text-[14.5px] leading-[1.65] text-white/[0.6]">Don&apos;t trust AI with your business? Good — neither do we, unsupervised. A human expert reviews your agent&apos;s work, approves anything customer-facing, and signs every report.</p>
            <div className="mt-6 flex flex-wrap gap-3"><Link href="/start" className="inline-flex items-center bg-white text-black px-5 py-3 rounded-full text-[13.5px] font-semibold hover:opacity-85">Try it free →</Link><Link href="#pricing" className="inline-flex items-center px-5 py-3 rounded-full text-[13.5px] text-white hover:bg-white/[0.05]" style={{ border: "1px solid rgba(255,255,255,0.16)" }}>See pricing →</Link></div>
          </div>
        </div>
      </div>
    </section>
  );
}
