import { CAPABILITIES, CREDIT_PRICES, FREE_ACTIONS, TOP_UP_PACKS, WARN_AT, CREDITS_PAY_FOR_WORK, CREDITS_PER_BOOKED_CALL, fmtUsd } from "@/lib/agentProgram/config";

/** §5 — the full per-action price list and the guards, straight from config. */
export default function CreditPriceList() {
  const groups = [
    ...CAPABILITIES.map((c) => ({ key: c.key, name: c.name, prices: CREDIT_PRICES.filter((p) => p.capability === c.key) })),
    { key: "human", name: "Human overseer", prices: CREDIT_PRICES.filter((p) => p.capability === "human") },
  ];
  return (
    <section className="px-6 pt-4 pb-16 md:pb-20 scroll-mt-24" id="credits">
      {/* Visible expandable right after the ROI calculator (Roman, 2026-10-10): impossible to miss, closed by default so the calculator stays the hero. */}
      <details className="max-w-[1100px] mx-auto group rounded-[22px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.1)" }}>
        <summary className="list-none cursor-pointer select-none p-6 md:p-7 flex items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#30D158] mb-2">Every price, published</div>
            <div className="text-[22px] md:text-[28px] font-bold tracking-[-0.03em] leading-[1.1]">See the full per-action credit breakdown</div>
            <p className="mt-2 text-[13.5px] text-white/[0.55] max-w-[680px]">One credit type. The same list the agent is charged against — if a number changes here, it changed in the ledger too. 1 booked call ≈ {CREDITS_PER_BOOKED_CALL} credits.</p>
          </div>
          <span className="shrink-0 inline-flex items-center justify-center h-[40px] px-5 rounded-full text-[13px] font-semibold text-black bg-white group-open:bg-white/[0.1] group-open:text-white transition-colors"><span className="group-open:hidden">Show all {CREDIT_PRICES.length} prices</span><span className="hidden group-open:inline">Hide</span></span>
        </summary>
      <div className="px-6 md:px-7 pb-7">

        <div className="mt-9 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => (
            <div key={g.key} className="rounded-[16px] p-5" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="text-[13px] font-semibold text-white">{g.name}</div>
              <ul className="mt-3 flex flex-col gap-1.5">
                {g.prices.map((p) => (
                  <li key={p.key} className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="text-white/[0.65]">{p.label}</span>
                    <span className="flex-1 border-b border-dotted border-white/[0.12] translate-y-[-3px]" />
                    <span className="text-white tabular-nums">{p.credits}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="rounded-[16px] p-5" style={{ background: "rgba(48,209,88,0.06)", border: "1px solid rgba(48,209,88,0.2)" }}>
            <div className="text-[13px] font-semibold text-[#30D158]">Free, always</div>
            <ul className="mt-3 flex flex-col gap-1.5">
              {FREE_ACTIONS.map((f) => (<li key={f} className="flex items-baseline justify-between text-[13px]"><span className="text-white/[0.75]">{f}</span><span className="text-[#30D158]">0</span></li>))}
            </ul>
          </div>
        </div>

        <div className="mt-8 grid md:grid-cols-2 gap-4">
          <div className="rounded-[16px] p-5" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-[13px] font-semibold text-white">The guards</div>
            <ul className="mt-3 flex flex-col gap-2 text-[13.5px] text-white/[0.7] leading-[1.5]">
              <li>• Warning email and banner at {Math.round(WARN_AT * 100)}% of the month&apos;s credits.</li>
              <li>• At zero the agent pauses. You are never charged beyond what you bought.</li>
              <li>• Failed work — errors, bounces, no result — costs 0 credits.</li>
              <li>• {CREDITS_PAY_FOR_WORK}</li>
            </ul>
          </div>
          <div className="rounded-[16px] p-5" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-[13px] font-semibold text-white">Top-ups — never expire</div>
            <ul className="mt-3 flex flex-col gap-2">
              {TOP_UP_PACKS.map((p) => (
                <li key={p.credits} className="flex items-baseline justify-between text-[13.5px]"><span className="text-white/[0.75]">{p.name}</span><span className="text-white">{fmtUsd(p.usd)}<span className="text-white/[0.4] text-[12px]"> · {(p.usd / p.credits).toFixed(2)}/credit</span></span></li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] text-white/[0.45]">Monthly plan credits spend first and reset each cycle; top-up credits stay while your membership is active.</p>
          </div>
        </div>
      </div>
      </details>
    </section>
  );
}
