import type { Metadata } from "next";
import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";
import ServiceInquiryForm from "@/components/marketing/ServiceInquiryForm";

export const metadata: Metadata = {
  title: "AI Receptionist",
  description:
    "A configurable AI-assisted customer intake and communication system — built around the specific workflows, FAQs, and routing logic of your business.",
};

const CONTENT_AREAS = [
  {
    number: "01",
    title: "Customer Intake",
    body: "Structured intake flows that gather the information your team needs before the first human conversation — reducing back-and-forth and improving response quality.",
  },
  {
    number: "02",
    title: "FAQ Handling",
    body: "Common questions answered consistently and immediately. The knowledge base is configured around your actual business — hours, services, pricing structure, policies.",
  },
  {
    number: "03",
    title: "Lead Capture",
    body: "Contact information and inquiry context captured before a lead goes cold. Leads are structured and routed to the right place rather than landing in a generic inbox.",
  },
  {
    number: "04",
    title: "Appointment Routing",
    body: "For businesses that take bookings, the AI Receptionist can route scheduling requests to the appropriate workflow — without the system making commitments the business hasn't configured it to make.",
  },
  {
    number: "05",
    title: "Business Information",
    body: "Location, hours, service area, team structure — the AI Receptionist knows what the business wants customers to know, and communicates it clearly.",
  },
  {
    number: "06",
    title: "Handoff to Humans",
    body: "When a conversation exceeds what the system is configured to handle, it escalates cleanly. No dead ends, no dropped conversations — a smooth transition to a real team member.",
  },
];

export default function AIReceptionistPage() {
  return (
    <div className="bg-black text-white min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="pt-[120px] pb-20 md:pb-28 px-6">
        <div className="max-w-[1180px] mx-auto">
          <Reveal>
            <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-5 block">
              Solutions / AI Receptionist
            </span>
            <h1 className="text-[40px] sm:text-[56px] md:text-[72px] font-extrabold tracking-[-0.03em] leading-[1.04] max-w-[860px]">
              A first contact layer{" "}
              <span className="font-serif-accent italic">configured</span> for
              your business.
            </h1>
            <p className="mt-7 text-[17px] md:text-[19px] leading-relaxed text-white/55 max-w-[640px]">
              The AI Receptionist is not a generic chatbot. It is a configurable
              communication and intake system built around the specific workflows,
              FAQs, and routing logic of your business.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-20 md:py-28 px-6 border-t border-white/[0.08]">
        <div className="max-w-[1180px] mx-auto">
          <Reveal>
            <SectionHead
              label="What it handles"
              title={
                <>
                  Six capability areas,{" "}
                  <span className="font-serif-accent italic">one</span> unified
                  experience.
                </>
              }
              description="Each area is configured to match how your business actually operates — not applied from a generic template."
            />
          </Reveal>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-px mt-2" style={{ background: "rgba(255,255,255,0.06)" }}>
            {CONTENT_AREAS.map((area) => (
              <Reveal key={area.number}>
                <div className="p-8" style={{ background: "#050505" }}>
                  <div className="font-mono text-[11px] text-white/20 mb-4">
                    {area.number}
                  </div>
                  <div className="text-[15px] font-semibold text-white/90 mb-3">
                    {area.title}
                  </div>
                  <p className="text-[13px] leading-relaxed text-white/45">
                    {area.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture / honesty section */}
      <section className="py-20 md:py-28 px-6 border-t border-white/[0.08]">
        <div className="max-w-[1180px] mx-auto">
          <Reveal>
            <SectionHead
              label="How it works"
              title="Configured per business. Honest about its boundaries."
            />
          </Reveal>

          <div className="grid md:grid-cols-2 gap-12 items-start">
            <Reveal>
              <div className="space-y-6 text-[15px] leading-relaxed text-white/55">
                <p>
                  The AI Receptionist is architecturally capable of handling
                  intake, FAQ responses, lead capture, appointment routing, and
                  escalation to human staff. What it actually does in any
                  deployment is a function of how it is configured for that
                  specific business.
                </p>
                <p>
                  Capabilities are scoped, tested, and documented during
                  onboarding. SFB does not promise a set of behaviors that depend
                  on factors outside our control — instead, the system is built
                  with explicit boundaries: clear topics it handles, clear
                  escalation paths for topics it doesn&apos;t, and no ambiguity
                  for the customer about when they&apos;re talking to an AI.
                </p>
                <p>
                  When a conversation needs a human, the handoff is clean. When a
                  question is outside the system&apos;s configured scope, it
                  escalates rather than guessing. That is a design decision, not
                  a limitation.
                </p>
              </div>
            </Reveal>

            <Reveal>
              <div className="space-y-px" style={{ background: "rgba(255,255,255,0.06)" }}>
                {[
                  { label: "Configured to your business", desc: "Knowledge base, tone, scope, and routing all set up during onboarding." },
                  { label: "Tested before deployment", desc: "Edge cases and escalation paths are validated against real scenarios before the system goes live." },
                  { label: "Explicit escalation", desc: "Out-of-scope conversations route to a human — no dead ends, no hallucinated answers." },
                  { label: "Updatable over time", desc: "As the business changes — new services, new policies — the configuration is updated to match." },
                ].map((item) => (
                  <div key={item.label} className="p-6" style={{ background: "#060606" }}>
                    <div className="text-[14px] font-semibold text-white/90 mb-1.5">
                      {item.label}
                    </div>
                    <p className="text-[12.5px] leading-relaxed text-white/40">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Within the stack */}
      <section className="py-20 md:py-28 px-6 border-t border-white/[0.08]">
        <div className="max-w-[1180px] mx-auto">
          <Reveal>
            <div className="grid md:grid-cols-2 gap-12 items-start">
              <div>
                <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-5 block">
                  Within the SFB stack
                </span>
                <h2 className="text-[28px] md:text-[38px] font-bold tracking-[-0.025em] leading-[1.1]">
                  Contact is the bridge between discovery and operations.
                </h2>
              </div>
              <div className="space-y-5 text-[15px] leading-relaxed text-white/55 pt-2 md:pt-10">
                <p>
                  AI Presence and the website bring the customer to the door. The
                  AI Receptionist is the door. When it works well, intake is fast
                  and structured, the customer feels handled professionally, and
                  your team receives the information they need to follow through.
                </p>
                <p>
                  The AI Receptionist connects directly to automation workflows
                  — leads captured by the intake system can trigger routing,
                  CRM updates, and follow-up sequences without any manual
                  intervention.
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
              defaultInterest="AI Receptionist"
              ctaLabel="Build My AI Receptionist"
              title="Tell us about your business"
            />
          </Reveal>
        </div>
      </section>

      <Footer />
    </div>
  );
}
