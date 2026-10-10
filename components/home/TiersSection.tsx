import Link from "next/link";
import Reveal from "@/components/ui/Reveal";
import AgentTiersRow from "@/components/home/AgentTiersRow";
import { CREDITS_PAY_FOR_WORK, PRICING_NOTE } from "@/lib/agentProgram/config";

/**
 * Homepage pricing: a giant "Pricing" wordmark fading from white to black
 * with the three frosted-glass tier cards overlapping its lower half
 * (reference supplied 2026-10-09). Cards and numbers come from AgentTiersRow /
 * TIERS; nothing is hard-coded here.
 */
export default function TiersSection() {
  return (
    <section className="relative overflow-hidden pt-20 md:pt-28 pb-24 md:pb-32 scroll-mt-24" id="pricing" style={{ background: "#000" }}>
      {/* soft dot grid */}
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "22px 22px", maskImage: "radial-gradient(ellipse at 50% 35%, rgba(0,0,0,0.9), transparent 70%)", WebkitMaskImage: "radial-gradient(ellipse at 50% 35%, rgba(0,0,0,0.9), transparent 70%)" }} />
      <div className="relative max-w-[1180px] mx-auto px-6">
        <Reveal>
          <div className="text-center">
            <span className="inline-flex items-center h-[26px] px-[10px] rounded-full bg-[#151515] border border-white/[0.08] text-[9px] font-semibold tracking-[0.08em] text-white/[0.78]">SFB AGENT</span>
            <p className="mt-4 text-[15px] text-white/[0.5]">Free on a sample business. Live on yours from $1,497/month.</p>
          </div>
        </Reveal>

        <div className="relative mt-6">
          <h2
            aria-label="Pricing"
            className="select-none text-center font-semibold leading-[0.82] tracking-[-0.06em]"
            style={{
              fontSize: "clamp(104px, 22vw, 290px)",
              backgroundImage: "linear-gradient(180deg, #ffffff 0%, #d9d9d9 38%, rgba(120,120,120,0.55) 68%, rgba(0,0,0,0) 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Pricing
          </h2>
          <div className="relative -mt-[0.42em] lg:-mt-[0.5em]" style={{ zIndex: 1 }}>
            <AgentTiersRow />
          </div>
        </div>

        <div className="mt-12 rounded-[12px] px-5 py-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-[12.5px] text-white/[0.62] max-w-[900px] mx-auto" style={{ background: "rgba(10,10,10,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span>Cancel anytime</span><span className="text-white/[0.3]">·</span><span>Month-to-month</span><span className="text-white/[0.3]">·</span><span>No contracts</span><span className="text-white/[0.3]">·</span><span>{CREDITS_PAY_FOR_WORK}</span>
        </div>
        <p className="mt-4 text-center text-[12px] text-white/[0.4]">{PRICING_NOTE}</p>
        <p className="mt-5 text-center text-[13px]"><Link href="/pricing" className="text-white/[0.75] hover:text-white underline underline-offset-4 decoration-white/[0.25]">Full pricing: how it works, annual billing, ROI calculator, every credit price →</Link></p>
      </div>
    </section>
  );
}
