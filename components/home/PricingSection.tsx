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
    <section
      className="py-24 md:py-32 section-band relative overflow-hidden"
      id="pricing"
    >
      <div
        className="absolute inset-0 bg-center bg-cover opacity-[0.32] pointer-events-none"
        style={{
          backgroundImage:
            "url(https://pub.hyperagent.com/api/published/pbf01M1PX1MRK_64YV090V4P6624Z4/terrarium_frame.jpg)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black via-black/70 to-black pointer-events-none" />
      <div className="max-w-[1200px] mx-auto px-8 relative z-10">
        <Reveal>
          <SectionHead
            label="One Price"
            title="$200. For the year."
            description="No monthly subscription."
            center
          />
        </Reveal>
        <Reveal>
          <div className="max-w-[520px] mx-auto bg-gradient-to-b from-white/[0.09] to-white/[0.03] border border-white/10 rounded-[32px] p-11 backdrop-blur-2xl">
            <span className="text-[15px] text-medium-gray font-medium">
              SFB Connect AI Presence
            </span>
            <div className="flex items-baseline gap-2 my-5 mb-8">
              <span className="font-mono text-[60px] font-semibold">
                $200
              </span>
              <span className="text-base text-medium-gray">/ year</span>
            </div>
            <ul className="flex flex-col gap-3.5 mb-9">
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
            <Link
              href="/pay"
              className="block w-full text-center bg-white text-black py-[18px] rounded-full font-bold text-base hover:scale-[1.02] transition-transform"
            >
              Start My AI Presence
            </Link>
            <div className="text-center text-[12.5px] text-medium-gray mt-4">
              Pay via Cash App, PayPal, or Zelle. Renews annually.
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
