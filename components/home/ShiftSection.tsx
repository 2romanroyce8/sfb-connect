"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, MoreHorizontal, Star, MapPin, ArrowUp } from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";

const OLD_RESULTS = [
  {
    domain: "localplumbingcompany.com",
    title: "Local Plumbing Company",
    description:
      "Plumbing repair, drain cleaning, emergency services and more.",
    rating: "4.8",
    reviews: "312 reviews",
  },
  {
    domain: "rapidrooter.com",
    title: "Rapid Rooter Co.",
    description: "Residential and commercial plumbing services.",
    rating: "4.7",
    reviews: "198 reviews",
  },
  {
    domain: "metropipeworks.com",
    title: "Metro Pipe Works",
    description: "Licensed plumbers serving the surrounding area.",
    rating: "4.6",
    reviews: "145 reviews",
  },
];

const AI_RESULTS = [
  {
    rank: "1",
    name: "Acme Plumbing",
    location: "2.1 mi away",
    rating: "4.9",
    reviews: "428",
    service: "Emergency plumbing · Drain repair",
    reason: "Best overall match for your location and service need.",
    badge: "Best match",
    highlight: true,
  },
  {
    rank: "2",
    name: "Rapid Rooter Co.",
    location: "3.6 mi away",
    rating: "4.8",
    reviews: "316",
    service: "Drain cleaning · Same-day service",
    reason: "Strong reviews and fast availability.",
    highlight: false,
  },
  {
    rank: "3",
    name: "Metro Pipe Works",
    location: "4.3 mi away",
    rating: "4.7",
    reviews: "259",
    service: "Residential plumbing · Leak repair",
    reason: "Good option for residential repair work.",
    highlight: false,
  },
];

const SOURCE_CHIPS = ["Business website", "Reviews", "Local listings"];

function AiChatPanel() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const step = (delaySec: number) => ({
    transitionDelay: visible ? `${delaySec}s` : "0s",
  });

  return (
    <div
      ref={ref}
      className={`ai-chat-panel${
        visible ? " is-visible" : ""
      } bg-[#111111] border border-white/[0.14] rounded-[24px] overflow-hidden min-h-[500px] shadow-[0_30px_100px_rgba(0,0,0,0.45)] flex flex-col`}
    >
      <div className="flex items-center justify-between h-[58px] px-[18px] border-b border-white/[0.08] shrink-0">
        <div className="flex items-center gap-2 text-[13px] font-medium text-white/80">
          <MessageSquare size={15} strokeWidth={1.75} />
          AI Assistant
        </div>
        <MoreHorizontal size={16} className="text-white/40" />
      </div>

      <div className="p-[22px] flex-1">
        <div
          className="ai-chat-fade ml-auto mb-[22px] max-w-[74%] inline-block bg-[#2A2A2A] text-[#F3F3F3] rounded-[18px_18px_6px_18px] px-4 py-3 text-[14px]"
          style={step(0.15)}
        >
          Who is the best plumber near me?
        </div>

        <div
          className="ai-chat-fade flex items-start gap-2.5 mb-[18px]"
          style={step(0.35)}
        >
          <div className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
            AI
          </div>
          <p className="text-[14px] leading-relaxed text-white/[0.82]">
            Based on service area, reviews, specialty match, availability,
            and the business information I can verify, these are the
            strongest options:
          </p>
        </div>

        <div className="flex flex-col gap-2.5 pl-[38px]">
          {AI_RESULTS.map((r, i) => (
            <div
              key={r.rank}
              className={`ai-chat-fade grid grid-cols-[32px_1fr] gap-3 items-start p-[14px] rounded-[14px] border ${
                r.highlight
                  ? "bg-[#1A1A1A] border-white/[0.24] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                  : "bg-[#171717] border-white/[0.08]"
              }`}
              style={step(0.55 + i * 0.15)}
            >
              <div className="w-8 h-8 rounded-full bg-[#242424] flex items-center justify-center text-[12px] text-white/70">
                {r.rank}
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold text-white">
                    {r.name}
                  </span>
                  {r.badge && (
                    <span className="text-[10px] font-semibold px-2 py-[5px] rounded-full bg-white text-black shrink-0">
                      {r.badge}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-[3px] text-[12px] text-white/[0.46]">
                  <span className="inline-flex items-center gap-1">
                    <Star size={11} className="fill-white/60 text-white/60" />
                    {r.rating} ({r.reviews})
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={11} />
                    {r.location}
                  </span>
                </div>
                <div className="text-[13px] text-white/[0.7] mt-1">
                  {r.service}
                </div>
                <div className="text-[12px] leading-relaxed text-white/[0.66] mt-2">
                  {r.reason}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="ai-chat-fade flex gap-1.5 flex-wrap mt-4 pl-[38px]" style={step(1)}>
          {SOURCE_CHIPS.map((s) => (
            <span
              key={s}
              className="text-[10px] px-[9px] py-[6px] rounded-full bg-[#1A1A1A] border border-white/[0.08] text-white/[0.52]"
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      <div className="mx-[18px] mb-[18px] h-[46px] shrink-0 bg-[#1C1C1C] border border-white/10 rounded-[22px] flex items-center justify-between px-[14px]">
        <span className="text-[12px] text-white/[0.34]">Ask a follow-up</span>
        <ArrowUp size={14} className="text-white/40" />
      </div>
    </div>
  );
}

export default function ShiftSection() {
  return (
    <section className="py-24 md:py-32 section-band" id="shift">
      <div className="max-w-[1200px] mx-auto px-8">
        <Reveal>
          <SectionHead
            label="The Shift"
            title={
              <>
                Search gave people choices.
                <br />
                AI gives people{" "}
                <span className="font-serif-accent italic font-normal">
                  answers.
                </span>
              </>
            }
          />
        </Reveal>
        <Reveal>
          <div className="grid md:grid-cols-2 gap-7 items-stretch">
            <div className="bg-[#0D0D0D] border border-white/[0.12] rounded-[24px] p-7 min-h-[500px] flex flex-col">
              <div className="font-mono text-[14px] text-white/45 mb-[22px]">
                2016
              </div>
              <div className="text-2xl font-semibold mb-7 leading-snug">
                &quot;best plumber near me&quot;
              </div>

              <div className="flex items-center gap-[7px] mb-4">
                <span className="w-[9px] h-[9px] rounded-full bg-[#5C5C5C]" />
                <span className="w-[9px] h-[9px] rounded-full bg-[#5C5C5C]" />
                <span className="w-[9px] h-[9px] rounded-full bg-[#5C5C5C]" />
                <div className="flex-1 h-[34px] bg-[#181818] rounded-[10px] flex items-center px-3 text-[12.5px] text-white/50 ml-2">
                  best plumber near me
                </div>
              </div>

              <div className="flex-1">
                {OLD_RESULTS.map((r) => (
                  <div
                    key={r.domain}
                    className="py-[18px] border-b border-white/[0.06] last:border-b-0"
                  >
                    <div className="text-[12px] text-white/45">
                      {r.domain}
                    </div>
                    <div className="text-[17px] font-medium text-[#D8D8D8] mt-1">
                      {r.title}
                    </div>
                    <div className="text-[13px] leading-relaxed text-white/[0.48] mt-1">
                      {r.description}
                    </div>
                    <div className="text-[12px] text-white/40 mt-1.5">
                      ★ {r.rating} · {r.reviews}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-[22px] text-[13px] text-white/[0.38] font-mono">
                Pages of links. The customer has to compare everything.
              </div>
            </div>

            <AiChatPanel />
          </div>
        </Reveal>
        <Reveal>
          <p className="mt-14 text-lg md:text-xl leading-relaxed text-[#c7c7cc] max-w-[920px]">
            That difference changes the competition. Search makes customers
            evaluate options. AI increasingly evaluates options first and
            presents a shorter answer.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
