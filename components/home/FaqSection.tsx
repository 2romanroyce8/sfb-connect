"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import Reveal from "@/components/ui/Reveal";

const FAQS = [
  // Final copy — Atlas copy pack 2026-10-09.
  { q: "What exactly am I buying?", a: "An AI agent assigned to your business, plus the human expert who oversees it. Eight capabilities you toggle on or off — outbound, Meta ads, website, CRM and automations, chat and texting, reviews, AI presence, and SOPs. You watch everything it does from your SFB login.", color: "#42E36D" },
  { q: "Which capabilities should I turn on?", a: "Start with the pain. No pipeline? Outbound. Losing leads after the click? Chat and CRM. Invisible when customers ask AI? AI Presence. Your human overseer recommends the right mix on onboarding — you make the final call, and you can change it anytime.", color: "#42E36D" },
  { q: "How do credits work?", a: "Your agent runs on credits. Every task has a public per-action price — simple tasks cost little, big builds cost more, and you always see the receipt. As a rough guide: one listing fix is 1 credit, one ad creative is 5, and one fully worked booked-call motion is about 15. Monthly credits don't roll over; top-up packs never expire while your membership is active. Sending messages, viewing reports, and toggling capabilities cost nothing.", color: "#42E36D" },
  { q: "What happens at zero credits?", a: "The agent pauses — you're never charged beyond what you bought. You get a warning email at 80% usage. When credits hit zero, top up or wait for your monthly refill. The ledger never goes negative; there are no surprise charges.", color: "#42E36D" },
  { q: "Do I pay for work that fails?", a: "No. If the agent errors, bounces, or produces no result, you pay zero credits. Completed work consumes credits even if you don't love the output — that's what the human overseer and the approval step are for.", color: "#42E36D" },
  { q: "Who is the human overseer?", a: "A named expert assigned to your account. They review your agent's work, approve anything customer-facing before it goes out, and sign every report. The agent does the work; the human makes sure it's right.", color: "#42E36D" },
  { q: "Can I cancel?", a: "Monthly plans cancel anytime — no contracts, no sales call required. Your plan stays active through the end of the paid period, and your data and reports stay exportable.", color: "#42E36D" },
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
    q: "Is pricing monthly or annual?",
    a: "Both. Plans start at an introductory $19.99/month with Revenue Presence, or save with annual billing. Revenue Growth and Revenue Dominance are for businesses that want SFB Connect to actively do the work or fully manage it for them. Book a demo and we'll help you pick the right one.",
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
  {
    q: "Do I need add-ons?",
    a: "No. Your SFB plan works on its own. Add-ons expand coverage, capacity, execution, or human support when your business needs more.",
    color: "#4DD9A0",
  },
  {
    q: "Can I add another location?",
    a: "Yes. Eligible additional locations can be added separately without requiring a completely different base plan.",
    color: "#4D8DFF",
  },
  {
    q: "What are Action Credits?",
    a: "Action Credits are additional execution capacity for eligible SFB actions beyond what's included with your plan.",
    color: "#FFD84D",
  },
  {
    q: "Do credits guarantee results?",
    a: "No. Credits pay for the specified SFB work or analysis. They do not guarantee AI rankings, leads, or revenue.",
    color: "#FF4D4D",
  },
  {
    q: "Can I cancel recurring add-ons?",
    a: "Yes. Recurring add-ons can be canceled at any time from your account, and stay active through the end of the period you've already paid for rather than ending immediately.",
    color: "#A96CFF",
  },
  {
    q: "Does Dominance still need add-ons?",
    a: "Dominance includes SFB's highest level of core management. Add-ons are primarily useful when a business needs additional scale, locations, markets, capacity, or specialized services.",
    color: "#FF8A3D",
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
        background: isOpen ? "#111111" : "#0c0c0c",
        borderColor: isOpen ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)",
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
          style={{
            background: "#050505",
            border: "1px solid rgba(255,255,255,0.045)",
            padding: "56px 32px",
          }}
        >
          <div className="pt-0.5">
            <span
              className="inline-flex items-center justify-center h-6 px-[9px] rounded-[5px] text-[10px] font-medium mb-[22px]"
              style={{
                background: "#101010",
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
