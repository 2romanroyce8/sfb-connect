"use client";

import { useState } from "react";
import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";

const FAQS = [
  {
    q: "What is AI Presence?",
    a: "AI Presence describes how clearly and reliably AI-assisted discovery systems can understand information about your business from available digital sources.",
  },
  {
    q: "Can you guarantee I will rank #1 on ChatGPT?",
    a: "No. AI recommendations vary by platform, query, context, location and available information. SFB Connect optimizes the signals that can improve your discoverability and relevance.",
  },
  {
    q: "Why does this take 14 days?",
    a: "The service includes analysis, competitive research, business information review, optimization work and final quality control rather than an automated instant report.",
  },
  {
    q: "Is this SEO?",
    a: "It overlaps with certain technical SEO concepts but focuses specifically on how business information is structured, understood and represented for AI-assisted discovery.",
  },
  {
    q: "Is $200 monthly?",
    a: "No. SFB Connect costs $200 for the entire year.",
  },
  {
    q: "Which businesses is this for?",
    a: "Local companies, service businesses, professional services, restaurants, contractors, home services, retail companies and other businesses customers may discover through AI.",
  },
];

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-24 md:py-32 section-band" id="faq">
      <div className="max-w-[1200px] mx-auto px-8">
        <Reveal>
          <SectionHead label="Questions" title="Frequently Asked" />
        </Reveal>
        <Reveal>
          <div className="max-w-[760px]">
            {FAQS.map((item, i) => (
              <div
                key={item.q}
                className={`border-t border-white/10 ${
                  i === FAQS.length - 1 ? "border-b" : ""
                }`}
              >
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full text-left bg-none border-none text-white py-6 text-[17px] font-semibold cursor-pointer flex justify-between items-center gap-4"
                >
                  {item.q}
                  <span
                    className={`font-mono text-xl text-medium-gray transition-transform shrink-0 ${
                      open === i ? "rotate-45" : ""
                    }`}
                  >
                    +
                  </span>
                </button>
                <div
                  className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
                  style={{ maxHeight: open === i ? "200px" : "0px" }}
                >
                  <p className="text-[15px] leading-relaxed text-medium-gray pb-6 max-w-[640px]">
                    {item.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
