import Reveal from "@/components/ui/Reveal";
import AgentTiersRow from "@/components/home/AgentTiersRow";
import { CREDITS_PAY_FOR_WORK, PRICING_NOTE } from "@/lib/agentProgram/config";

/**
 * Homepage pricing = the three SFB Agent tiers, nothing else. The standalone
 * AI Presence plans, calculator, credits price list and demo form were removed
 * from the homepage on 2026-10-09 (Roman); the full price list lives on /agent.
 */
export default function TiersSection() {
  return (
    <section className="relative overflow-hidden section-band pt-24 md:pt-32 pb-24 md:pb-32 scroll-mt-24" id="pricing">
      <div className="max-w-[1180px] mx-auto px-6">
        <Reveal>
          <div className="max-w-[780px] mx-auto text-center">
            <span className="inline-flex items-center h-[26px] px-[10px] rounded-full bg-[#151515] border border-white/[0.08] text-[9px] font-semibold tracking-[0.08em] text-white/[0.78]">PRICING</span>
            <h2 className="mt-[18px] text-[42px] sm:text-[56px] md:text-[68px] font-semibold leading-[0.98] tracking-[-0.05em] text-[#f7f7f7]">Plans and Pricing</h2>
            <p className="max-w-[560px] mx-auto mt-[18px] text-[14px] leading-relaxed text-white/[0.42]">Get your agent free on a sample business. Go live on yours from $1,497/month.</p>
          </div>
        </Reveal>
        <div className="mt-12">
          <AgentTiersRow />
        </div>
        <div className="mt-10 rounded-[12px] px-5 py-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-[12.5px] text-white/[0.62] max-w-[900px] mx-auto" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span>Cancel anytime</span><span className="text-white/[0.3]">·</span><span>Month-to-month</span><span className="text-white/[0.3]">·</span><span>No contracts</span><span className="text-white/[0.3]">·</span><span>{CREDITS_PAY_FOR_WORK}</span>
        </div>
        <p className="mt-4 text-center text-[12px] text-white/[0.4]">{PRICING_NOTE}</p>
      </div>
    </section>
  );
}
