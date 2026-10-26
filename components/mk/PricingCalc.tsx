"use client";
import { useState } from "react";

// Real arithmetic, shown on screen. Enter YOUR wholesale cost; nothing here is a price list.
export default function PricingCalc() {
  const [setup, setSetup] = useState(450); const [monthly, setMonthly] = useState(45); const [markup, setMarkup] = useState(100);
  const m = 1 + markup / 100; const rs = setup * m; const rm = monthly * m;
  const margin = (r: number, c: number) => (r > 0 ? ((r - c) / r) * 100 : 0);
  const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const field = (label: string, v: number, set: (n: number) => void, unit: string) => (
    <label className="flex flex-col gap-1.5 text-[13px]" style={{ color: "var(--mk-muted)" }}>{label}
      <div className="relative"><input type="number" min={0} className="mk-input" value={v} onChange={(e) => set(Math.max(0, Number(e.target.value) || 0))} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px]">{unit}</span></div></label>
  );
  return (
    <div className="mk-card p-6 md:p-8">
      <div className="grid gap-3 sm:grid-cols-3">{field("Your setup cost", setup, setSetup, "$")}{field("Your monthly cost", monthly, setMonthly, "$/mo")}{field("Markup", markup, setMarkup, "%")}</div>
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {[["Suggested retail setup", usd(rs)], ["Suggested retail monthly", usd(rm)], ["Gross margin", `${margin(rm, monthly).toFixed(0)}%`], ["Recurring profit / client / yr", usd((rm - monthly) * 12)]].map(([k, v]) => (
          <div key={k} className="rounded-[12px] p-4" style={{ background: "var(--mk-bg2)", border: "1px solid var(--mk-border)" }}><div className="text-[12px]" style={{ color: "var(--mk-muted)" }}>{k}</div><div className="text-[24px] font-semibold mt-1">{v}</div></div>))}
      </div>
      <p className="mt-4 text-[12.5px]" style={{ color: "var(--mk-muted)" }}>Retail = cost × (1 + markup). Margin = (retail − cost) ÷ retail. Defaults are placeholders to show the math, not SFB Connect prices. Usage-based costs (such as voice minutes) are extra.</p>
    </div>
  );
}
