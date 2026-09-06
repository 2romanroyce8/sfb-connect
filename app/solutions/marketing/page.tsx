import type { Metadata } from "next";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";
import ServiceInquiryForm from "@/components/marketing/ServiceInquiryForm";

export const metadata: Metadata = {
  title: "Marketing",
  description:
    "Growth strategy and digital marketing that extends the technology foundation SFB already builds — not a replacement for it.",
};

const FOCUS_AREAS = [
  {
    number: "01",
    title: "Strategy",
    body: "Where to focus, which audiences to build toward, and how to prioritize growth initiatives given the existing technology foundation. Marketing decisions made with the full picture — not in isolation from the website, SEO structure, and AI presence work already in place.",
  },
  {
    number: "02",
    title: "Campaign Planning",
    body: "Campaign architecture built around business objectives rather than platform defaults. Each campaign is planned with a clear purpose, a defined audience, and measurable success criteria.",
  },
  {
    number: "03",
    title: "Creative Direction",
    body: "Visual and written creative direction that reflects how the business actually wants to be perceived — consistent with the brand, not generic. Creative is treated as a strategic asset, not a production task.",
  },
  {
    number: "04",
    title: "Digital Growth Systems",
    body: "Repeatable systems for content, distribution, and lead generation — built to run sustainably rather than require constant reinvention. Growth that compounds over time rather than depending on continuous manual output.",
  },
];

export default function MarketingPage() {
  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="pt-[120px] pb-20 md:pb-28 px-6">
        <div className="max-w-[1180px] mx-auto">
          <Reveal>
            <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-5 block">
              Solutions / Marketing
            </span>
            <h1 className="text-[40px] sm:text-[56px] md:text-[72px] font-extrabold tracking-[-0.03em] leading-[1.04] max-w-[900px]">
              Growth strategy that{" "}
              <span className="font-serif-accent italic">extends</span> the
              technology foundation.
            </h1>
            <p className="mt-7 text-[17px] md:text-[19px] leading-relaxed text-white/55 max-w-[640px]">
              Marketing at SFB is subordinate to the technology stack — by design.
              Growth strategy that ignores the website, the AI presence layer, and
              the intake system underneath it is working against itself.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Positioning */}
      <section className="py-20 md:py-28 px-6 border-t border-white/[0.08]">
        <div className="max-w-[1180px] mx-auto">
          <Reveal>
            <div className="grid md:grid-cols-2 gap-12 items-start">
              <div>
                <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-5 block">
                  Why this matters
                </span>
                <h2 className="text-[28px] md:text-[38px] font-bold tracking-[-0.025em] leading-[1.1]">
                  Marketing works when the infrastructure underneath it works.
                </h2>
              </div>
              <div className="space-y-5 text-[15px] leading-relaxed text-white/55 pt-2 md:pt-10">
                <p>
                  Spending on traffic before the website converts is waste.
                  Running campaigns before the intake system is operational means
                  leads fall through. Building content before the AI presence
                  layer is in place means AI systems may not be able to correctly
                  attribute that content to the business.
                </p>
                <p>
                  SFB&apos;s marketing engagements start by assessing the state of
                  the technology foundation. Growth initiatives are planned in the
                  context of what is already built — so every campaign, creative
                  asset, and distribution effort is working with the system, not
                  around it.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Focus areas */}
      <section className="py-20 md:py-28 px-6 border-t border-white/[0.08]">
        <div className="max-w-[1180px] mx-auto">
          <Reveal>
            <SectionHead
              label="Focus areas"
              title={
                <>
                  Strategy, creative, and{" "}
                  <span className="font-serif-accent italic">systems</span>.
                </>
              }
              description="Four areas that form a coherent marketing engagement — not a menu of disconnected services."
            />
          </Reveal>

          <div className="flex flex-col gap-px mt-2" style={{ background: "rgba(255,255,255,0.06)" }}>
            {FOCUS_AREAS.map((area) => (
              <Reveal key={area.number}>
                <div
                  className="grid md:grid-cols-[80px_220px_1fr] gap-6 items-start p-8 md:p-10"
                  style={{ background: "#050505" }}
                >
                  <div className="font-mono text-[12px] text-white/20">
                    {area.number}
                  </div>
                  <div className="text-[17px] font-semibold text-white/90">
                    {area.title}
                  </div>
                  <p className="text-[14px] leading-relaxed text-white/50 max-w-[540px]">
                    {area.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* What this is not */}
      <section className="py-20 md:py-28 px-6 border-t border-white/[0.08]">
        <div className="max-w-[1180px] mx-auto">
          <Reveal>
            <SectionHead
              label="What to expect"
              title="Not a retainer factory. A growth partnership with context."
              description="SFB marketing engagements are scoped to what makes sense given the business's stage, budget, and existing infrastructure — not a standard monthly deliverable list applied uniformly."
            />
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-px mt-14" style={{ background: "rgba(255,255,255,0.06)" }}>
            {[
              {
                label: "Connected to the stack",
                body: "Every marketing decision accounts for the website, AI presence, intake system, and automation already in place.",
              },
              {
                label: "Scoped to the business",
                body: "Engagements are scoped based on actual business goals and constraints — not a menu of services sold by default.",
              },
              {
                label: "Built to compound",
                body: "Growth systems are designed to get more efficient over time — not require continuous reinvestment to hold a position.",
              },
              {
                label: "Transparent about tradeoffs",
                body: "SFB will tell you when a marketing initiative depends on infrastructure that isn't in place yet — and what needs to happen first.",
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

      {/* CTA Form */}
      <section className="py-24 md:py-32 px-6 border-t border-white/[0.08]">
        <div className="max-w-[680px] mx-auto">
          <Reveal>
            <ServiceInquiryForm
              defaultInterest="Marketing"
              ctaLabel="Discuss Marketing"
              title="Tell us about your growth goals"
            />
          </Reveal>
        </div>
      </section>

      <Footer />
    </div>
  );
}
