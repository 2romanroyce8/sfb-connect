"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PRICING_FAQ } from "@/lib/agentProgram/pricing";
import { trackMarketingEvent } from "@/lib/marketingEvents";

/** §7 — the five questions people ask right before they buy. */
export default function PricingFaq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="px-6 py-16 md:py-20 scroll-mt-24" id="faq">
      <div className="max-w-[820px] mx-auto">
        <h2 className="text-[30px] md:text-[40px] font-bold tracking-[-0.035em] leading-[1.05]">Before you decide</h2>
        <div className="mt-8 flex flex-col gap-2.5">
          {PRICING_FAQ.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="rounded-[11px] overflow-hidden border transition-colors" style={{ background: isOpen ? "#111111" : "#0c0c0c", borderColor: isOpen ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)" }}>
                <button onClick={() => { setOpen(isOpen ? null : i); if (!isOpen) trackMarketingEvent("pricing_faq_open", { q: f.q }); }} className="w-full min-h-[58px] px-[18px] flex items-center justify-between gap-4 text-left" aria-expanded={isOpen}>
                  <span className="text-[14.5px] font-medium leading-[1.35] text-white">{f.q}</span>
                  <Plus size={18} strokeWidth={1.8} className="shrink-0 transition-transform duration-200" style={{ color: "#30D158", transform: isOpen ? "rotate(45deg)" : "none" }} />
                </button>
                {isOpen && <p className="px-[18px] pb-[18px] text-[13px] leading-[1.6] text-white/[0.55] max-w-[92%]">{f.a}</p>}
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-[13px] text-white/[0.45]">Still unsure? <Link href="/start" className="text-white underline underline-offset-4 decoration-white/[0.25]">Start free on a sample business</Link> — $0, no card.</p>
      </div>
    </section>
  );
}
