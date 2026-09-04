import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";
import IcebergComparison from "@/components/ui/IcebergComparison";

export default function AlgorithmSection() {
  return (
    <section className="py-24 md:py-32 section-band" id="algorithm">
      <div className="max-w-[1200px] mx-auto px-8">
        <Reveal>
          <SectionHead
            label="Why This Matters"
            title="The same internet does not look the same to everyone."
          />
        </Reveal>
        <Reveal>
          <p className="max-w-[700px] text-lg leading-relaxed text-[#c7c7cc] mb-16">
            Modern recommendation systems evaluate context. Location, intent,
            relevance, preferences, history and available information can
            influence what gets surfaced. Most business owners optimize for
            what a human eye finds impressive — but that&apos;s only the tip
            of what actually determines whether AI recommends you.
          </p>
        </Reveal>
        <Reveal>
          <IcebergComparison />
        </Reveal>
        <Reveal>
          <div className="mt-14 text-center font-mono text-sm text-medium-gray tracking-wide max-w-[560px] mx-auto leading-relaxed">
            RECOMMENDATION SYSTEMS RECOMMEND WHAT THEY CAN VERIFY — NOT WHAT
            IMPRESSES A HUMAN EYE.
          </div>
        </Reveal>
      </div>
    </section>
  );
}
