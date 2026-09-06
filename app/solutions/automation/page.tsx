import type { Metadata } from "next";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";
import ServiceInquiryForm from "@/components/marketing/ServiceInquiryForm";

export const metadata: Metadata = {
  title: "Automation",
  description:
    "Custom business automation systems that remove repetitive work — lead routing, intake, follow-up workflows, CRM operations, and internal process automation.",
};

const CATEGORIES = [
  {
    number: "01",
    title: "Lead Routing",
    body: "New leads go to the right person or queue immediately — without manual triage. Routing rules are built around your actual sales process.",
  },
  {
    number: "02",
    title: "Customer Intake",
    body: "Structured intake flows that collect the right information upfront, reducing back-and-forth before a job or project even begins.",
  },
  {
    number: "03",
    title: "Appointment Workflows",
    body: "Scheduling, confirmation, and reminder logic built around how your business actually handles appointments — not a generic booking template.",
  },
  {
    number: "04",
    title: "Follow-Up Workflows",
    body: "Timely, contextual follow-up sequences that happen automatically after key events — quotes sent, calls completed, jobs finished.",
  },
  {
    number: "05",
    title: "CRM Workflows",
    body: "Record creation, stage updates, task assignment, and data enrichment that keep your CRM accurate without manual upkeep.",
  },
  {
    number: "06",
    title: "Internal Operations",
    body: "Team notifications, task creation, handoff logic, and internal coordination that runs reliably in the background.",
  },
  {
    number: "07",
    title: "Notifications",
    body: "The right alert to the right channel at the right moment — built around events that actually matter to your operations.",
  },
  {
    number: "08",
    title: "Business Process Automation",
    body: "Broader operational workflows — document generation, approval chains, status tracking, and reporting that previously required human coordination.",
  },
];

export default function AutomationPage() {
  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="pt-[120px] pb-20 md:pb-28 px-6">
        <div className="max-w-[1180px] mx-auto">
          <Reveal>
            <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-5 block">
              Solutions / Automation
            </span>
            <h1 className="text-[40px] sm:text-[56px] md:text-[72px] font-extrabold tracking-[-0.03em] leading-[1.04] max-w-[860px]">
              Systems that remove{" "}
              <span className="font-serif-accent italic">repetitive</span> work.
            </h1>
            <p className="mt-7 text-[17px] md:text-[19px] leading-relaxed text-white/55 max-w-[620px]">
              Business automation at SFB is built around the tools and workflows
              your team already uses — not an off-the-shelf product suite imposed
              on top of your operations.
            </p>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 md:py-28 px-6 border-t border-white/[0.08]">
        <div className="max-w-[1180px] mx-auto">
          <Reveal>
            <SectionHead
              label="The approach"
              title="Built around your existing tools."
              description="SFB doesn't impose a fixed technology stack. Automation systems are scoped to the actual processes you need to streamline — using whichever platforms your business already operates on."
            />
          </Reveal>

          <div className="grid sm:grid-cols-3 gap-px mt-14" style={{ background: "rgba(255,255,255,0.06)" }}>
            {[
              {
                step: "01",
                label: "Map",
                body: "We document the current workflow — every manual step, handoff, and decision point — before designing any automation.",
              },
              {
                step: "02",
                label: "Build",
                body: "Automation logic is built to match your actual process, not a generic template. Edge cases are accounted for before launch.",
              },
              {
                step: "03",
                label: "Maintain",
                body: "As your business evolves, workflows are updated. Automation that breaks silently is worse than no automation.",
              },
            ].map((item) => (
              <Reveal key={item.step}>
                <div className="p-8 md:p-10" style={{ background: "#020202" }}>
                  <div className="font-mono text-[11px] text-white/25 mb-4">
                    {item.step}
                  </div>
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

      {/* Categories */}
      <section className="py-20 md:py-28 px-6 border-t border-white/[0.08]">
        <div className="max-w-[1180px] mx-auto">
          <Reveal>
            <SectionHead
              label="What gets automated"
              title={
                <>
                  Eight categories,{" "}
                  <span className="font-serif-accent italic">one</span>{" "}
                  connected system.
                </>
              }
              description="Automation is most powerful when individual workflows connect to each other. A lead that comes in triggers intake, intake triggers routing, routing triggers a follow-up sequence — and the whole chain runs without anyone touching it manually."
            />
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-px mt-2" style={{ background: "rgba(255,255,255,0.06)" }}>
            {CATEGORIES.map((cat) => (
              <Reveal key={cat.number}>
                <div
                  className="grid grid-cols-[44px_1fr] gap-5 p-8"
                  style={{ background: "#050505" }}
                >
                  <div className="font-mono text-[12px] text-white/20 pt-1">
                    {cat.number}
                  </div>
                  <div>
                    <div className="text-[16px] font-semibold text-white/90 mb-2">
                      {cat.title}
                    </div>
                    <p className="text-[13px] leading-relaxed text-white/45">
                      {cat.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Positioning note */}
      <section className="py-20 md:py-28 px-6 border-t border-white/[0.08]">
        <div className="max-w-[1180px] mx-auto">
          <Reveal>
            <div className="grid md:grid-cols-2 gap-12 items-start">
              <div>
                <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-5 block">
                  Within the SFB stack
                </span>
                <h2 className="text-[28px] md:text-[38px] font-bold tracking-[-0.025em] leading-[1.1]">
                  Automation works because the rest of the stack is already in place.
                </h2>
              </div>
              <div className="space-y-5 text-[15px] leading-relaxed text-white/55 pt-2 md:pt-8">
                <p>
                  When the AI receptionist captures a lead, that lead needs to go
                  somewhere. When the website converts a visitor, someone needs to
                  follow up. Automation is the connective tissue between every
                  other layer SFB builds.
                </p>
                <p>
                  Businesses that already have an SFB website or AI receptionist
                  can connect those systems to automation workflows — reducing the
                  gap between a customer action and an internal response.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA Form */}
      <section className="py-24 md:py-32 px-6 border-t border-white/[0.08]">
        <div className="max-w-[680px] mx-auto">
          <Reveal>
            <ServiceInquiryForm
              defaultInterest="Automation"
              ctaLabel="Discuss an Automation"
              title="Tell us what's repetitive"
            />
          </Reveal>
        </div>
      </section>

      <Footer />
    </div>
  );
}
