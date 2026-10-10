import { REPLACED_VENDORS, TIERS, fmtUsd } from "@/lib/agentProgram/config";
import { VENDOR_GRID_HEADLINE, vendorsTotalLine } from "@/lib/agentProgram/pricing";

/**
 * §6 — the six vendors one Solo plan replaces. Per-vendor and total monthly
 * figures are Rome's blanks: a vendor's cost line renders only when set, and
 * the total falls back to the wording he offered ("thousands").
 */
export default function VendorGrid() {
  const solo = TIERS.find((t) => t.key === "solo")!;
  return (
    <section className="px-6 py-16 md:py-20 scroll-mt-24" id="vendors">
      <div className="max-w-[1100px] mx-auto">
        <h2 className="text-[34px] md:text-[52px] font-bold tracking-[-0.04em] leading-[1]">{VENDOR_GRID_HEADLINE}</h2>
        <div className="mt-10 grid md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {REPLACED_VENDORS.map((v) => (
              <div key={v.name} className="rounded-[14px] p-4 min-h-[88px] flex flex-col justify-between" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="text-[13.5px] font-medium text-white/[0.85] line-through decoration-white/[0.35]">{v.name}</div>
                {v.monthlyUsd !== null && <div className="text-[12.5px] text-white/[0.45]">{fmtUsd(v.monthlyUsd)}/mo</div>}
              </div>
            ))}
          </div>
          <div className="text-center text-[13px] font-semibold tracking-[0.14em] uppercase text-white/[0.4]">vs</div>
          <div className="sfb-glass rounded-[18px] p-7 text-center">
            <div className="text-[12px] font-semibold tracking-[0.12em] uppercase text-white/[0.55]">One agent · {solo.name}</div>
            <div className="mt-2 text-[44px] font-semibold tracking-[-0.04em] leading-none text-white">{fmtUsd(solo.monthlyUsd)}<span className="text-[16px] text-white/[0.5]">/mo</span></div>
            <div className="mt-2 text-[12.5px] text-white/[0.5]">+ {fmtUsd(solo.onboardingUsd)} one-time setup</div>
          </div>
        </div>
        <div className="mt-8 rounded-[14px] px-5 py-4 flex flex-wrap items-center justify-between gap-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="text-[14px] text-white/[0.75]">Six vendors, six invoices, six people to chase: <strong className="text-white">{vendorsTotalLine()}</strong>.</div>
          <div className="text-[14px] text-white/[0.75]">One agent, one invoice: <strong className="text-[#30D158]">{fmtUsd(solo.monthlyUsd)}/mo</strong>.</div>
        </div>
      </div>
    </section>
  );
}
