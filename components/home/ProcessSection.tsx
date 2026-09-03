import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";

const steps = [
  {
    num: "01",
    title: "Business Intake",
    time: "DAY 0",
    desc: "You submit your company, services, products, locations, website and existing public presence.",
  },
  {
    num: "02",
    title: "AI Presence Audit",
    time: "DAYS 1–4",
    desc: "We analyze how clearly machines can identify your business, services, geography, specialties, authority signals and existing digital entities.",
  },
  {
    num: "03",
    title: "Competitive Analysis",
    time: "DAYS 4–7",
    desc: "We compare your visibility signals against businesses competing for similar customer intent.",
  },
  {
    num: "04",
    title: "Knowledge Optimization",
    time: "DAYS 7–11",
    desc: "We structure and improve business information so your company is represented clearly and consistently across eligible public sources and machine-readable formats.",
  },
  {
    num: "05",
    title: "AI Presence Build",
    time: "DAYS 11–14",
    desc: "We implement the approved optimization work and produce your final AI Presence profile.",
  },
  {
    num: "06",
    title: "Presence Report",
    time: "DAY 14",
    desc: "Receive your completed audit, optimization report, AI Presence Score and prioritized recommendations.",
  },
];

export default function ProcessSection() {
  return (
    <section className="py-24 md:py-32 section-band" id="process">
      <div className="max-w-[1200px] mx-auto px-8">
        <Reveal>
          <SectionHead
            label="The System"
            title={
              <>
                14 days. One{" "}
                <span className="font-serif-accent italic font-normal">
                  complete
                </span>{" "}
                AI Presence analysis.
              </>
            }
          />
        </Reveal>
        <Reveal>
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full aspect-[3/1] object-cover rounded-2xl mb-16"
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_125119_8e5ae31c-0021-4396-bc08-f7aebeb877a2.mp4"
          />
        </Reveal>
        <Reveal>
          <div className="flex flex-col">
            {steps.map((s, i) => (
              <div
                key={s.num}
                className={`grid grid-cols-[50px_1fr] sm:grid-cols-[80px_1fr_140px] gap-6 py-8 border-t border-white/10 items-start ${
                  i === steps.length - 1 ? "border-b" : ""
                }`}
              >
                <div className="font-mono text-xl text-medium-gray font-medium">
                  {s.num}
                </div>
                <div>
                  <div className="text-lg font-bold mb-2">{s.title}</div>
                  <div className="text-[14.5px] text-medium-gray leading-relaxed max-w-[520px]">
                    {s.desc}
                  </div>
                </div>
                <div className="font-mono text-[12.5px] text-medium-gray text-right tracking-wide col-span-2 sm:col-span-1 mt-1 sm:mt-0">
                  {s.time}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
