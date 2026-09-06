import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";
import ServiceInquiryForm from "@/components/marketing/ServiceInquiryForm";

export const metadata: Metadata = {
  title: "Solutions",
  description:
    "SFB Connect builds the technology stack that connects every stage of the customer journey — from AI discovery to operations.",
};

const JOURNEY = [
  {
    stage: "Discover",
    service: "AI Presence",
    description:
      "Before a customer visits your website or picks up the phone, they ask an AI. AI Presence ensures that when that moment happens, machines understand your business clearly enough to surface it.",
    href: "/#score",
    cta: "Explore AI Presence",
    number: "01",
  },
  {
    stage: "Visit",
    service: "Website",
    description:
      "The destination machines point to and customers trust. SFB builds websites that work as both conversion architecture and machine-readable business intelligence.",
    href: "/websites",
    cta: "Explore Websites",
    number: "02",
  },
  {
    stage: "Contact",
    service: "AI Receptionist",
    description:
      "The first live touchpoint after discovery. An AI-assisted intake system that handles customer questions, captures leads, and routes the right conversations to your team.",
    href: "/solutions/ai-receptionist",
    cta: "Explore AI Receptionist",
    number: "03",
  },
  {
    stage: "Operate",
    service: "Automation",
    description:
      "The internal layer that makes everything sustainable. Custom workflows that remove repetitive work from your team so the business runs at scale without proportional overhead.",
    href: "/solutions/automation",
    cta: "Explore Automation",
    number: "04",
  },
  {
    stage: "Grow",
    service: "Marketing + Paid Ads",
    description:
      "Growth strategy built on top of the technology foundation — not as a replacement for it. Campaign planning, creative direction, and paid acquisition that extends the infrastructure already in place.",
    href: "/solutions/marketing",
    cta: "Explore Marketing",
    number: "05",
  },
];

export default function SolutionsPage() {
  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="pt-[120px] pb-20 md:pb-28 px-6">
        <div className="max-w-[1180px] mx-auto">
          <Reveal>
            <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-5 block">
              Solutions
            </span>
            <h1 className="text-[40px] sm:text-[56px] md:text-[72px] font-extrabold tracking-[-0.03em] leading-[1.04] max-w-[900px]">
              Technology that connects the{" "}
              <span className="font-serif-accent italic">entire</span> customer
              journey.
            </h1>
            <p className="mt-7 text-[17px] md:text-[19px] leading-relaxed text-white/55 max-w-[640px]">
              SFB Connect is not a collection of loosely related services. Every
              product is designed to hand off cleanly to the next stage of how
              customers find, evaluate, and work with a business.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Journey Flow */}
      <section className="py-16 md:py-24 px-6">
        <div className="max-w-[1180px] mx-auto">
          <Reveal>
            <div className="mb-14">
              <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray">
                The customer journey
              </span>
            </div>
          </Reveal>

          <div className="relative">
            {/* Connecting line */}
            <div
              className="absolute left-[27px] top-0 bottom-0 w-px hidden md:block"
              style={{ background: "rgba(255,255,255,0.08)" }}
            />

            <div className="flex flex-col gap-px" style={{ background: "rgba(255,255,255,0.06)" }}>
              {JOURNEY.map((step, i) => (
                <Reveal key={step.number}>
                  <div
                    className="grid md:grid-cols-[56px_160px_1fr_auto] gap-6 items-start md:items-center px-0 md:px-2 py-10 md:py-14"
                    style={{ background: "#000" }}
                  >
                    {/* Number */}
                    <div className="font-mono text-[13px] text-white/25 pt-0.5">
                      {step.number}
                    </div>

                    {/* Stage label */}
                    <div>
                      <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-medium-gray block mb-1.5">
                        Stage
                      </span>
                      <div className="text-[22px] md:text-[28px] font-bold tracking-[-0.02em] text-white">
                        {step.stage}
                      </div>
                      <div className="text-[12px] text-white/35 mt-1">
                        {step.service}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-[14px] md:text-[15px] leading-relaxed text-white/50 max-w-[540px]">
                      {step.description}
                    </p>

                    {/* CTA */}
                    <Link
                      href={step.href}
                      className="group flex items-center gap-1.5 text-[13px] font-medium text-white whitespace-nowrap md:justify-self-end"
                    >
                      {step.cta}
                      <ArrowRight
                        size={13}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </Link>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why one company */}
      <section className="py-24 md:py-32 px-6 border-t border-white/[0.08]">
        <div className="max-w-[1180px] mx-auto">
          <Reveal>
            <SectionHead
              label="One technology company"
              title={
                <>
                  Built to work{" "}
                  <span className="font-serif-accent italic">together</span>,
                  not just alongside each other.
                </>
              }
              description="Most agencies hand you disconnected vendors for each channel. SFB Connect is engineered as a single integrated stack — the AI presence data informs the website architecture, the website feeds the AI receptionist, automation connects the intake to operations, and marketing amplifies everything underneath. Each layer is more effective because the others exist."
            />
          </Reveal>

          <div className="grid sm:grid-cols-3 gap-px mt-14" style={{ background: "rgba(255,255,255,0.06)" }}>
            {[
              {
                label: "Integrated by design",
                body: "Every product shares a common data and logic layer. Changes in one service propagate where they should, without manual re-work.",
              },
              {
                label: "No vendor juggling",
                body: "One relationship, one point of accountability. No coordination tax between an SEO agency, a web developer, and an automation consultant.",
              },
              {
                label: "Built around the business",
                body: "Each engagement is scoped to the actual business — not off-the-shelf templates or one-size-fits-all playbooks.",
              },
            ].map((item) => (
              <Reveal key={item.label}>
                <div className="p-8 md:p-10" style={{ background: "#020202" }}>
                  <div className="text-[15px] font-semibold text-white/90 mb-3">
                    {item.label}
                  </div>
                  <p className="text-[13.5px] leading-relaxed text-white/45">
                    {item.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Sub-page links */}
      <section className="py-16 md:py-20 px-6 border-t border-white/[0.08]">
        <div className="max-w-[1180px] mx-auto">
          <Reveal>
            <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-10 block">
              Explore solutions
            </span>
          </Reveal>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-px" style={{ background: "rgba(255,255,255,0.06)" }}>
            {[
              { title: "Automation", href: "/solutions/automation", desc: "Remove repetitive work through custom business workflows." },
              { title: "AI Receptionist", href: "/solutions/ai-receptionist", desc: "AI-assisted customer intake and communication." },
              { title: "Marketing", href: "/solutions/marketing", desc: "Growth strategy that extends the technology foundation." },
              { title: "Paid Ads", href: "/solutions/paid-ads", desc: "Campaign strategy, creative, and paid acquisition." },
            ].map((item) => (
              <Reveal key={item.title}>
                <Link
                  href={item.href}
                  className="group flex flex-col justify-between p-7 min-h-[180px] transition-colors hover:bg-white/[0.02]"
                  style={{ background: "#0a0a0a" }}
                >
                  <div>
                    <div className="text-[16px] font-medium text-white/90 mb-2">
                      {item.title}
                    </div>
                    <p className="text-[12.5px] leading-relaxed text-white/40">
                      {item.desc}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-[11.5px] text-white/50 mt-5">
                    Explore
                    <ArrowRight size={11} className="transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Form */}
      <section className="py-24 md:py-32 px-6 border-t border-white/[0.08]">
        <div className="max-w-[680px] mx-auto">
          <Reveal>
            <ServiceInquiryForm
              defaultInterest="Not Sure"
              ctaLabel="Discuss My Project"
              title="Not sure where to start?"
            />
          </Reveal>
        </div>
      </section>

      <Footer />
    </div>
  );
}
