import Link from "next/link";
import StatusBadge from "@/components/agent/StatusBadge";
import { fetchAgentModules } from "@/lib/agentProgram/modules";

// Homepage teaser for the SFB Agent program. Module statuses come from the
// same database rows as /agent, so the two can never disagree.
export default async function AgentTeaserSection() {
  const modules = await fetchAgentModules();
  return (
    <section className="py-20 md:py-28 px-6" id="agent">
      <div className="max-w-[1180px] mx-auto rounded-[18px] p-8 md:p-12" style={{ background: "#050505", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#30D158] mb-4">Meet your SFB Agent</div>
            <h2 className="text-[34px] md:text-[48px] font-bold leading-[1] tracking-[-0.04em]">Your business, run by an agent. <span className="font-serif-accent italic font-normal text-white/[0.86]">Overseen by a human.</span></h2>
            <p className="mt-5 text-[15px] leading-[1.6] text-white/[0.55] max-w-[560px]">One agent assigned to your business. It starts by getting you found by AI, then unlocks chat, follow-ups, website, ads and operations docs over time — every step reviewed by a human expert.</p>
            <Link href="/agent" className="mt-7 inline-flex items-center bg-white text-black px-6 py-3 rounded-full text-[14px] font-semibold hover:opacity-85 transition-opacity">See the agent →</Link>
          </div>
          <ul className="flex flex-col gap-2">
            {modules.map((m) => (
              <li key={m.key} className="flex items-center justify-between gap-3 rounded-[10px] px-4 py-3" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.07)", opacity: m.status === "roadmap" ? 0.75 : 1 }}>
                <span className="text-[13.5px] font-medium">{m.name}</span>
                <StatusBadge status={m.status} size="xs" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
