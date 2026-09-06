import type { Metadata } from "next";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";
import ServiceInquiryForm from "@/components/marketing/ServiceInquiryForm";

export const metadata: Metadata = {
  title: "Paid Ads",
  description:
    "Paid advertising campaign strategy, creative direction, landing-page alignment, tracking setup, and ongoing optimization — built around the business's actual conversion infrastructure.",
};

const FOCUS_AREAS = [
  {
    number: "01",
    title: "Campaign Strategy",
    body: "Channel selection, audience definition, budget structure, and campaign architecture — decided based on the business's goals and the conversion infrastructure already in place, not default platform recommendations.",
  },
  {
    number: "02",
    title: "Creative",
    body: "Ad creative — copy, visual direction, and format — built to match the audience and the platform. Creative is treated as a strategic variable, not a production commodity.",
  },
  {
    number: "03",
    title: "Landing-Page Alignment",
    body: "Paid traffic is only as effective as the page it lands on. SFB reviews and, where needed, builds landing pages that match the promise of the ad and are structured to convert.",
  },
  {
    number: "04",
    title: "Tracking",
    body: "Conversion tracking configured correctly before money is spent. Accurate attribution is a prerequisite for meaningful optimization — not an afterthought.",
  },
  {
    number: "05",
    title: "Optimization",
    body: "Ongoing review of campaign performance against defined goals. Budget allocation, creative rotation, audience refinement, and bid strategy adjusted based on what the data shows — not assumptions.",
  },
];

export default function PaidAdsPage() {
  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="pt-[120px] pb-20 md:pb-28 px-6">
        <div className="max-w-[1180px] mx-auto">
          <Reveal>
            <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-5 block">
              Solutions / Paid Ads
            </span>
            <h1 className="text-[40px] sm:text-[56px] md:text-[72px] font-extrabold tracking-[-0.03em] leading-[1.04] max-w-[860px]">
              Paid acquisition built on a{" "}
              <span className="font-serif-accent italic">solid</span>{" "}
              foundation.
            </h1>
            <p className="mt-7 text-[17px] md:text-[19px] leading-relaxed text-white/55 max-w-[640px]">
              Paid advertising is a distribution mechanism, not a substitute for
              infrastructure. SFB builds paid campaigns on top of a website that
              converts, tracking that is accurate, and intake that doesn&apos;t
              drop leads.
            </p>
          </Reveal>
        </div>
      </section>

      {/* The prerequisite */}
      <section className="py-20 md:py-28 px-6 border-t border-white/[0.08]">
        <div className="max-w-[1180px] mx-auto">
          <Reveal>
            <div className="grid md:grid-cols-2 gap-12 items-start">
              <div>
                <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-5 block">
                  Before the campaign
                </span>
                <h2 className="text-[28px] md:text-[38px] font-bold tracking-[-0.025em] leading-[1.1]">
                  The infrastructure has to be ready first.
                </h2>
              </div>
              <div className="space-y-5 text-[15px] leading-relaxed text-white/55 pt-2 md:pt-10">
                <p>
                  Running paid ads to a website that wasn&apos;t designed to convert,
                  without accurate conversion tracking, is one of the most common
                  ways businesses waste advertising budget. The traffic arrives
                  and nothing happens — or worse, things happen but can&apos;t be
                  measured.
                </p>
                <p>
                  SFB reviews the conversion infrastructure before a campaign goes
                  live. If the landing page, tracking, or intake system isn&apos;t
                  ready, we say so — and either fix it first or scope the campaign
                  accordingly. Spending money on traffic before the destination
                  works is not a recommendation we make.
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
              label="What's involved"
              title={
                <>
                  Five areas that make a{" "}
                  <span className="font-serif-accent italic">paid campaign</span>{" "}
                  actually work.
                </>
              }
              description="Each area has to be handled correctly for the campaign to perform. Gaps in any one of them create problems that can't be fixed by budget alone."
            />
          </Reveal>

          <div className="flex flex-col gap-px mt-2" style={{ background: "rgba(255,255,255,0.06)" }}>
            {FOCUS_AREAS.map((area) => (
              <Reveal key={area.number}>
                <div
                  className="grid md:grid-cols-[80px_200px_1fr] gap-6 items-start p-8 md:p-10"
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

      {/* Within the stack */}
      <section className="py-20 md:py-28 px-6 border-t border-white/[0.08]">
        <div className="max-w-[1180px] mx-auto">
          <Reveal>
            <SectionHead
              label="Within the SFB stack"
              title="Paid ads amplify what's already working."
              description="The most effective paid campaigns run when the technology foundation is in place — the website is built to convert, the AI presence layer is optimized, the intake system captures leads reliably, and automation handles what happens next."
            />
          </Reveal>

          <div className="grid sm:grid-cols-3 gap-px mt-14" style={{ background: "rgba(255,255,255,0.06)" }}>
            {[
              {
                label: "Website alignment",
                body: "Landing pages built or reviewed as part of the campaign — not an afterthought. The ad and the destination should make the same promise.",
              },
              {
                label: "Intake readiness",
                body: "Leads generated by paid campaigns route through the same intake and automation infrastructure — no orphaned inquiries.",
              },
              {
                label: "Measurement first",
                body: "Tracking is set up and verified before budget is allocated. Decisions are made from real data, not platform-reported estimates.",
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
              defaultInterest="Paid Ads"
              ctaLabel="Discuss Paid Ads"
              title="Tell us about your ad goals"
            />
          </Reveal>
        </div>
      </section>

      <Footer />
    </div>
  );
}
