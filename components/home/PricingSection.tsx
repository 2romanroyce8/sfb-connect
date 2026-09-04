import Link from "next/link";
import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";

const FEATURES = [
  "Complete AI Presence Audit",
  "14-Day Business Analysis",
  "Competitive Presence Analysis",
  "Entity & Knowledge Analysis",
  "Machine Readability Analysis",
  "Structured Data Review",
  "AI Presence Optimization",
  "AI Presence Score",
  "Final Presence Report",
  "12 Months of SFB Connect Membership",
];

export default function PricingSection() {
  return (
    <section className="relative overflow-hidden" id="pricing">
      <div className="py-24 md:py-32 section-band relative">
        <div className="max-w-[1200px] mx-auto px-8">
          <Reveal>
            <SectionHead
              label="Pricing"
              title="Pricing built for local businesses."
              center
            />
          </Reveal>

          <Reveal>
            <div className="relative w-full max-w-[760px] mx-auto mt-14 h-[430px] md:h-[470px]">
              {/* Subtle arc graphic behind the cards */}
              <svg
                className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[92%] max-w-[720px] pointer-events-none"
                viewBox="0 0 720 300"
                fill="none"
              >
                <path
                  d="M80 300 C125 110 245 25 360 25 C475 25 595 110 640 300"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="52"
                  fill="none"
                />
                <path
                  d="M155 300 C190 155 270 95 360 95 C450 95 530 155 565 300"
                  stroke="rgba(255,255,255,0.035)"
                  strokeWidth="38"
                  fill="none"
                />
                <path
                  d="M245 300 C270 220 310 190 360 190 C410 190 450 220 475 300"
                  stroke="rgba(255,255,255,0.025)"
                  strokeWidth="22"
                  fill="none"
                />
              </svg>

              {/* Cards */}
              <div className="absolute inset-0 flex items-end justify-center gap-4 z-[2] px-4">
                {/* Base card — free score check */}
                <div
                  className="w-[240px] sm:w-[260px] rounded-[9px] overflow-hidden border border-white/[0.11] shadow-[0_20px_55px_rgba(0,0,0,0.28)] mb-[38px]"
                  style={{
                    background:
                      "linear-gradient(180deg, #2D2E31 0%, #202124 100%)",
                  }}
                >
                  <div className="h-[150px] px-6 pt-9 pb-5 text-center">
                    <div
                      className="text-[52px] font-medium leading-[0.9] tracking-[-0.055em]"
                      style={{ color: "rgba(0,0,0,0.28)" }}
                    >
                      <span className="text-[20px] align-top mr-[3px]">
                        $
                      </span>
                      0
                    </div>
                    <div className="mt-[18px] text-[12px] font-medium text-white/[0.78]">
                      Free Score Check
                    </div>
                  </div>
                  <div className="border-t border-dashed border-white/[0.06]" />
                  <div className="px-6 pt-6 pb-6 text-center">
                    <p className="text-[11px] leading-[1.45] text-white/[0.36] max-w-[190px] mx-auto mb-4">
                      See your current AI Presence Score and where you stand.
                      No cost, no card required.
                    </p>
                    <a
                      href="#score"
                      className="block w-full h-[35px] rounded-[3px] border border-white/[0.09] text-[11px] font-medium text-white/[0.62] flex items-center justify-center"
                    >
                      Check My Score
                    </a>
                  </div>
                </div>

                {/* Featured card — $200/year audit */}
                <div
                  className="w-[250px] sm:w-[270px] rounded-[9px] overflow-hidden border border-white/[0.14] shadow-[0_26px_65px_rgba(0,0,0,0.38)]"
                  style={{
                    background:
                      "linear-gradient(180deg, #505154 0%, #303135 100%)",
                  }}
                >
                  <div className="h-[150px] px-6 pt-9 pb-5 text-center">
                    <div
                      className="text-[56px] font-medium leading-[0.9] tracking-[-0.055em]"
                      style={{ color: "rgba(0,0,0,0.23)" }}
                    >
                      <span className="text-[22px] align-top mr-[3px]">
                        $
                      </span>
                      200
                    </div>
                    <div className="mt-[18px] text-[12px] font-medium text-white/[0.78]">
                      Per year
                    </div>
                  </div>
                  <div className="border-t border-dashed border-white/[0.06]" />
                  <div className="px-6 pt-6 pb-6 text-center">
                    <p className="text-[11px] leading-[1.45] text-white/[0.42] max-w-[190px] mx-auto mb-4">
                      The complete AI Presence Audit. No monthly
                      subscription.
                    </p>
                    <Link
                      href="/pay"
                      className="block w-full h-[35px] rounded-[4px] bg-[#F7F7F7] text-[11px] font-semibold text-[#111111] flex items-center justify-center hover:scale-[1.02] transition-transform"
                    >
                      Start My AI Presence
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal>
            <div className="text-center text-[12.5px] text-medium-gray mt-8">
              Pay via Cash App, PayPal, or Zelle. Renews annually.
            </div>
          </Reveal>
        </div>
      </div>

      {/* Features section beneath the pricing cards */}
      <div className="relative border-t border-white/[0.06] py-20 md:py-28">
        <div className="max-w-[1200px] mx-auto px-8">
          <Reveal>
            <SectionHead label="Features" title="What's included?" />
          </Reveal>
          <Reveal>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[720px]">
              {FEATURES.map((f) => (
                <li
                  key={f}
                  className="text-[14.5px] text-[#d4d4d8] pl-7 relative"
                >
                  <span className="absolute left-0 top-[3px] w-3.5 h-3.5 rounded-full border-[1.5px] border-white" />
                  <span className="absolute left-[5px] top-[7px] w-1.5 h-[3px] border-l-[1.5px] border-b-[1.5px] border-white -rotate-45" />
                  {f}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
