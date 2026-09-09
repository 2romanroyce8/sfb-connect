"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calculator } from "lucide-react";
import Reveal from "@/components/ui/Reveal";

// Same locked plan prices as PricingSection.tsx -- kept as a small local
// copy (not imported) since this is a marketing-page calculator, not a
// billing computation; the one place that actually charges anyone is the
// server-side SFB_PLAN_PRICES map used by the Sales OS revenue pipeline.
const CALC_PLANS = [
  { id: "presence", name: "Revenue Presence", price: 19.99 },
  { id: "growth", name: "Revenue Growth", price: 197 },
  { id: "dominance", name: "Revenue Dominance", price: 359 },
] as const;

function formatMoney(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

// Illustrative starting points only, editable per plan -- deliberately NOT
// the same number across tiers. Presence is monitoring-only (near-zero
// active work), so it shouldn't be credited with the same customer flow as
// a plan where SFB is actively running optimization or doing the work for
// you. These are starting assumptions for the visitor to correct, not a
// performance claim -- there's no historical data yet to back a specific
// multiplier, so we don't imply Growth "gets you 2x Presence" as fact.
const DEFAULT_EXPECTED_CUSTOMERS: Record<(typeof CALC_PLANS)[number]["id"], number> = {
  presence: 1,
  growth: 2,
  dominance: 4,
};

export default function RoiCalculator() {
  const [planId, setPlanId] = useState<(typeof CALC_PLANS)[number]["id"]>("growth");
  const [customerValue, setCustomerValue] = useState<number>(150);
  const [expectedByPlan, setExpectedByPlan] = useState(DEFAULT_EXPECTED_CUSTOMERS);

  const plan = CALC_PLANS.find((p) => p.id === planId)!;
  const expectedCustomers = expectedByPlan[planId];

  const { breakEvenCustomers, monthlyRevenue, monthlyProfit, roiMultiple } = useMemo(() => {
    const value = Math.max(customerValue, 0);
    const breakEven = value > 0 ? Math.ceil(plan.price / value) : null;
    const revenue = value * Math.max(expectedCustomers, 0);
    const profit = revenue - plan.price;
    const roi = plan.price > 0 ? revenue / plan.price : 0;
    return { breakEvenCustomers: breakEven, monthlyRevenue: revenue, monthlyProfit: profit, roiMultiple: roi };
  }, [plan.price, customerValue, expectedCustomers]);

  return (
    <Reveal>
      <div
        className="rounded-[16px] border p-7 md:p-9"
        style={{
          borderColor: "rgba(255,255,255,0.09)",
          background: "linear-gradient(180deg, rgba(28,28,30,0.96) 0%, rgba(15,15,16,0.98) 100%)",
        }}
      >
        <div className="flex items-center gap-2.5 mb-1.5">
          <div
            className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0"
            style={{ background: "rgba(66,227,109,0.14)" }}
          >
            <Calculator size={15} className="text-[#42E36D]" />
          </div>
          <h3 className="text-[19px] font-medium tracking-[-0.02em] text-[#f4f4f4]">
            Break-Even Calculator
          </h3>
        </div>
        <p className="text-[13px] leading-relaxed text-white/[0.42] max-w-[560px]">
          Enter your own numbers to see what a plan needs to deliver to pay for itself. This is
          simple math from the figures you enter below — not a promise or a historical average,
          since SFB doesn't have enough closed customers yet to publish real conversion data.
        </p>

        <div className="grid md:grid-cols-2 gap-8 mt-7">
          <div className="flex flex-col gap-5">
            <div>
              <label className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/[0.44]">
                Plan
              </label>
              <div className="flex gap-2 mt-2">
                {CALC_PLANS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlanId(p.id)}
                    className="flex-1 h-9 rounded-[7px] text-[11.5px] font-medium transition-colors"
                    style={
                      planId === p.id
                        ? { background: "#f5f5f5", color: "#090909" }
                        : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.56)", border: "1px solid rgba(255,255,255,0.08)" }
                    }
                  >
                    {p.name.replace("Revenue ", "")}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[11px] text-white/[0.36]">
                {plan.name} — {formatMoney(plan.price)}/mo
              </div>
            </div>

            <div className="text-[11.5px] leading-relaxed text-white/[0.4] rounded-[8px] p-3" style={{ background: "rgba(255,255,255,0.03)" }}>
              Each plan has its own "new customers/month" number below, on purpose — Presence is
              monitoring-only, while Growth and Dominance involve SFB actively working to bring in
              more. Set each one to what you'd actually expect from that plan, not the same number
              for all three.
            </div>

            <div>
              <label className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/[0.44]">
                Average value of one new customer
              </label>
              <div className="flex items-center mt-2 h-11 rounded-[8px] px-3.5 gap-1.5" style={{ background: "#0e0e0f", border: "1px solid rgba(255,255,255,0.09)" }}>
                <span className="text-white/40 text-[14px]">$</span>
                <input
                  type="number"
                  min={0}
                  value={customerValue}
                  onChange={(e) => setCustomerValue(Number(e.target.value) || 0)}
                  className="w-full bg-transparent outline-none text-[14px] text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/[0.44]">
                New customers you expect per month, from {plan.name.replace("Revenue ", "")}
              </label>
              <div className="flex items-center mt-2 h-11 rounded-[8px] px-3.5" style={{ background: "#0e0e0f", border: "1px solid rgba(255,255,255,0.09)" }}>
                <input
                  type="number"
                  min={0}
                  value={expectedCustomers}
                  onChange={(e) => {
                    const next = Number(e.target.value) || 0;
                    setExpectedByPlan((prev) => ({ ...prev, [planId]: next }));
                  }}
                  className="w-full bg-transparent outline-none text-[14px] text-white"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 justify-center">
            <div className="rounded-[10px] p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="text-[10.5px] uppercase tracking-[0.06em] text-white/[0.4]">
                Break-even point
              </div>
              <div className="text-[24px] font-medium text-white mt-1">
                {breakEvenCustomers === null
                  ? "—"
                  : `${breakEvenCustomers} new customer${breakEvenCustomers === 1 ? "" : "s"}/mo`}
              </div>
              <div className="text-[11.5px] text-white/[0.36] mt-1">
                At {formatMoney(customerValue)} each, that's what it takes to cover the {formatMoney(plan.price)}/mo plan cost.
              </div>
            </div>

            <div className="rounded-[10px] p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="text-[10.5px] uppercase tracking-[0.06em] text-white/[0.4]">
                At {expectedCustomers} new customer{expectedCustomers === 1 ? "" : "s"}/mo
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span
                  className="text-[24px] font-medium"
                  style={{ color: monthlyProfit >= 0 ? "#42E36D" : "#FF6B6B" }}
                >
                  {monthlyProfit >= 0 ? "+" : ""}
                  {formatMoney(monthlyProfit)}/mo
                </span>
                <span className="text-[11.5px] text-white/[0.36]">
                  ({formatMoney(monthlyRevenue)} revenue − {formatMoney(plan.price)} plan)
                </span>
              </div>
              {monthlyRevenue > 0 && (
                <div className="text-[11.5px] text-white/[0.36] mt-1">
                  That's {roiMultiple.toFixed(1)}x what the plan costs.
                </div>
              )}
            </div>

            <Link
              href="#book-a-demo"
              className="mt-1 h-[42px] rounded-[7px] text-[12px] font-semibold flex items-center justify-center transition-transform hover:scale-[1.02]"
              style={{ background: "#f5f5f5", color: "#090909" }}
            >
              Book a demo to see what fits your numbers →
            </Link>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
