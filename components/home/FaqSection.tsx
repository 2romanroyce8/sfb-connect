"use client";

import { useRef, useState } from "react";
import { Plus, ArrowUp, CornerDownLeft } from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import { answerQuestion } from "@/lib/faqAnswers";
import { trackMarketingEvent } from "@/lib/marketingEvents";

// Five questions only (Roman, 2026-10-09), then "Ask anything else": a text
// box answered from the fixed bank in lib/faqAnswers.ts. No backend, no AI,
// no invented answers -- an unmatched question says so and points to /start.
const FAQS = [
  { q: "What exactly am I buying?", a: "An AI agent assigned to your business, plus the human expert who oversees it. Eight capabilities you toggle on or off — outbound, Meta ads, website, CRM and automations, chat and texting, reviews, AI presence, and SOPs. You watch everything it does from your SFB login.", color: "#42E36D", defaultOpen: true },
  { q: "How do credits work?", a: "Your agent runs on credits. Every task has a public per-action price — simple tasks cost little, big builds cost more, and you always see the receipt. As a rough guide: one listing fix is 1 credit, one ad creative is 5, and one fully worked booked-call motion is about 15. Monthly credits don't roll over; top-up packs never expire while your membership is active. Sending messages, viewing reports, and toggling capabilities cost nothing.", color: "#42E36D" },
  { q: "Do I pay for work that fails?", a: "No. If the agent errors, bounces, or produces no result, you pay zero credits. Completed work consumes credits even if you don't love the output — that's what the human overseer and the approval step are for.", color: "#42E36D" },
  { q: "Who is the human overseer?", a: "A named expert assigned to your account. They review your agent's work, approve anything customer-facing before it goes out, and sign every report. The agent does the work; the human makes sure it's right.", color: "#42E36D" },
  { q: "Can I cancel?", a: "Monthly plans cancel anytime — no contracts, no sales call required. Your plan stays active through the end of the paid period, and your data and reports stay exportable.", color: "#42E36D" },
];

function FaqItem({ item, isOpen, onToggle }: { item: (typeof FAQS)[number]; isOpen: boolean; onToggle: () => void }) {
  const answerRef = useRef<HTMLDivElement>(null);
  return (
    <div
      className="rounded-[12px] border transition-colors duration-200"
      style={{ background: isOpen ? "#111111" : "#0c0c0c", borderColor: isOpen ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)" }}
    >
      <button onClick={onToggle} className="w-full min-h-[58px] px-[18px] flex items-center justify-between gap-[18px] text-left bg-none border-none cursor-pointer" aria-expanded={isOpen}>
        <span className="text-[14px] font-medium leading-[1.35] text-white max-w-[90%]">{item.q}</span>
        <Plus size={18} strokeWidth={1.8} className="shrink-0 transition-transform duration-200" style={{ color: item.color, transform: isOpen ? "rotate(45deg)" : "rotate(0deg)" }} />
      </button>
      <div className="overflow-hidden transition-[max-height] duration-300 ease-out" style={{ maxHeight: isOpen ? `${answerRef.current?.scrollHeight ?? 200}px` : "0px" }}>
        <div ref={answerRef} className="px-[18px] pb-[18px] max-w-[88%]">
          <p className="text-[12px] leading-[1.55] text-white/[0.46]">{item.a}</p>
        </div>
      </div>
    </div>
  );
}

type Exchange = { q: string; a: string; matched: string | null };

function AskAnything() {
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<Exchange[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const ask = () => {
    const q = value.trim();
    if (!q) return;
    const r = answerQuestion(q);
    setHistory((h) => [...h, { q, a: r.answer, matched: r.matched?.key ?? null }].slice(-6));
    setValue("");
    trackMarketingEvent("faq_question_asked", { matched: r.matched?.key ?? "none", length: q.length });
  };

  return (
    <div className="rounded-[12px] border" style={{ background: "#0c0c0c", borderColor: "rgba(255,255,255,0.08)" }}>
      <div className="px-[18px] pt-[16px] pb-[6px]">
        <div className="text-[14px] font-medium text-white">Ask anything else</div>
        <div className="text-[12px] text-white/[0.4] mt-1">Answered instantly from our set answers — no sales call, nothing made up.</div>
      </div>
      {history.length > 0 && (
        <div className="px-[18px] flex flex-col gap-3 py-2" aria-live="polite">
          {history.map((x, i) => (
            <div key={i} className="rounded-[10px] px-3.5 py-3" style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="text-[12.5px] text-white/[0.85] font-medium">{x.q}</div>
              <p className="text-[12px] leading-[1.55] text-white/[0.5] mt-1.5">
                {x.a.split(/(\/start|\/login)/).map((part, j) => part === "/start" || part === "/login" ? <a key={j} href={part} className="underline underline-offset-2 text-white/[0.8]">{part}</a> : part)}
              </p>
            </div>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => { e.preventDefault(); ask(); }}
        className="m-[12px] mt-[8px] flex items-center gap-2 rounded-[10px] px-3"
        style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Type your question…"
          aria-label="Ask anything else"
          maxLength={240}
          className="flex-1 h-[46px] bg-transparent outline-none text-[13.5px] text-white placeholder:text-white/[0.3]"
        />
        <button type="submit" aria-label="Ask" disabled={!value.trim()} className="h-[32px] w-[32px] rounded-full inline-flex items-center justify-center bg-white text-black disabled:opacity-30">
          <ArrowUp size={16} strokeWidth={2.2} />
        </button>
      </form>
      <div className="px-[18px] pb-[12px] text-[10.5px] text-white/[0.28] inline-flex items-center gap-1"><CornerDownLeft size={10} /> Enter to ask</div>
    </div>
  );
}

export default function FaqSection() {
  const defaultIndex = FAQS.findIndex((f) => "defaultOpen" in f && f.defaultOpen);
  const [open, setOpen] = useState<number | null>(defaultIndex);

  return (
    <section className="py-20 md:py-28 px-6" id="faq" style={{ background: "#000000" }}>
      <Reveal>
        <div
          className="max-w-[1180px] mx-auto grid md:grid-cols-[0.9fr_1.1fr] gap-12 md:gap-[110px] items-start rounded-[18px]"
          style={{ background: "#050505", border: "1px solid rgba(255,255,255,0.045)", padding: "56px 32px" }}
        >
          <div className="pt-0.5">
            <span className="inline-flex items-center justify-center h-6 px-[9px] rounded-[5px] text-[10px] font-medium mb-[22px]" style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.68)" }}>
              FAQs
            </span>
            <h2 className="text-[42px] md:text-[56px] font-medium leading-[0.96] tracking-[-0.045em] text-white mb-[22px]">
              Frequently asked <span style={{ color: "#ff4fa3" }}>questions</span>
            </h2>
            <p className="text-[15px] leading-relaxed text-white/[0.38] max-w-[340px]">
              The five things business owners ask before they start — and a box for everything else.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {FAQS.map((item, i) => (
              <FaqItem key={item.q} item={item} isOpen={open === i} onToggle={() => setOpen(open === i ? null : i)} />
            ))}
            <AskAnything />
          </div>
        </div>
      </Reveal>
    </section>
  );
}
