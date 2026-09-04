"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import Reveal from "@/components/ui/Reveal";

const FAQS = [
  {
    q: "Can you guarantee AI rankings?",
    a: "No. AI recommendations vary by platform, query, context, location and available information. SFB Connect optimizes the signals that can improve your discoverability and relevance — no platform can be guaranteed.",
    color: "#FF4D4D",
  },
  {
    q: "How long does the audit take?",
    a: "14 days. The service includes analysis, competitive research, business information review, optimization work and final quality control rather than an automated instant report.",
    color: "#FFD84D",
  },
  {
    q: "What platforms do you analyze?",
    a: "ChatGPT, Claude, Perplexity, Grok, Gemini, AI-powered search, and the AI assistants customers increasingly use to find and choose local businesses.",
    color: "#4D8DFF",
    defaultOpen: true,
  },
  {
    q: "Is the $200 monthly or annual?",
    a: "Annual. SFB Connect costs $200 for the entire year — no monthly subscription.",
    color: "#FF8A3D",
  },
  {
    q: "Which businesses is this for?",
    a: "Local companies, service businesses, professional services, restaurants, contractors, home services, retail companies and other businesses customers may discover through AI.",
    color: "#A96CFF",
  },
  {
    q: "Is this the same as SEO?",
    a: "It overlaps with certain technical SEO concepts but focuses specifically on how business information is structured, understood and represented for AI-assisted discovery.",
    color: "#FFFFFF",
  },
];

function FaqItem({
  item,
  isOpen,
  onToggle,
}: {
  item: (typeof FAQS)[number];
  isOpen: boolean;
  onToggle: () => void;
}) {
  const answerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="rounded-[11px] overflow-hidden border transition-colors duration-200"
      style={{
        background: isOpen ? "#140d0b" : "#120c0a",
        borderColor: isOpen ? "#5c3a22" : "#3d2716",
      }}
    >
      <button
        onClick={onToggle}
        className="w-full min-h-[58px] px-[18px] flex items-center justify-between gap-[18px] text-left bg-none border-none cursor-pointer"
      >
        <span className="text-[14px] font-medium leading-[1.35] text-white max-w-[90%]">
          {item.q}
        </span>
        <Plus
          size={18}
          strokeWidth={1.8}
          className="shrink-0 transition-transform duration-200"
          style={{
            color: item.color,
            transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
          }}
        />
      </button>
      <div
        className="overflow-hidden transition-[max-height] duration-300 ease-out"
        style={{
          maxHeight: isOpen ? `${answerRef.current?.scrollHeight ?? 200}px` : "0px",
        }}
      >
        <div ref={answerRef} className="px-[18px] pb-[18px] max-w-[88%]">
          <p className="text-[12px] leading-[1.55] text-white/[0.46]">
            {item.a}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function FaqSection() {
  const defaultIndex = FAQS.findIndex((f) => f.defaultOpen);
  const [open, setOpen] = useState<number | null>(defaultIndex);

  return (
    <section
      className="py-20 md:py-28 px-6"
      id="faq"
      style={{ background: "#000000" }}
    >
      <Reveal>
        <div
          className="max-w-[1180px] mx-auto grid md:grid-cols-[0.9fr_1.1fr] gap-12 md:gap-[110px] items-start rounded-[18px]"
          style={{ background: "#0b0604", padding: "56px 32px" }}
        >
          <div className="pt-0.5">
            <span
              className="inline-flex items-center justify-center h-6 px-[9px] rounded-[5px] text-[10px] font-medium mb-[22px]"
              style={{
                background: "#17110f",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.68)",
              }}
            >
              FAQs
            </span>
            <h2 className="text-[42px] md:text-[56px] font-medium leading-[0.96] tracking-[-0.045em] text-white mb-[22px]">
              Frequently asked{" "}
              <span style={{ color: "#ff4fa3" }}>questions</span>
            </h2>
            <p className="text-[15px] leading-relaxed text-white/[0.38] max-w-[340px]">
              Everything business owners ask before starting their AI
              Presence audit.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {FAQS.map((item, i) => (
              <FaqItem
                key={item.q}
                item={item}
                isOpen={open === i}
                onToggle={() => setOpen(open === i ? null : i)}
              />
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
