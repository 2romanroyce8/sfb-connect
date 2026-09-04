import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";
import AIEvaluationComparison from "@/components/ui/AIEvaluationComparison";
import ScoreRing from "@/components/ui/ScoreRing";

export default function AlgorithmSection() {
  return (
    <section className="py-24 md:py-32 section-band" id="algorithm">
      <div className="max-w-[1200px] mx-auto px-8">
        <Reveal>
          <SectionHead
            label="Why This Matters"
            title="Not every signal carries the same weight."
          />
        </Reveal>
        <Reveal>
          <p className="max-w-[720px] text-lg leading-relaxed text-[#c7c7cc] mb-20">
            Businesses often spend their attention on what looks impressive
            to people. AI discovery systems evaluate a different mix of
            identity, location, authority, structure, freshness and
            machine-readable information.
          </p>
        </Reveal>
        <Reveal>
          <AIEvaluationComparison />
        </Reveal>
        <Reveal>
          <p className="mt-20 text-xl md:text-2xl font-medium leading-snug tracking-[-0.025em] text-white/[0.82] max-w-[820px]">
            Looking impressive can help a customer trust you. Being
            structured, consistent and understandable helps AI know when to
            recommend you.
          </p>
        </Reveal>

        {/* Score section — merged into the same section, no border/gap break */}
        <div id="score" className="mt-24 md:mt-28">
          <Reveal>
            <SectionHead
              label="The Diagnostic"
              title={
                <>
                  Your AI{" "}
                  <span className="font-serif-accent italic font-normal">
                    Presence Score.
                  </span>
                </>
              }
            />
          </Reveal>
          <Reveal>
            <ScoreRing />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
