import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";
import AIEvaluationComparison from "@/components/ui/AIEvaluationComparison";
import ScoreRing from "@/components/ui/ScoreRing";

export default function AlgorithmSection() {
  return (
    <section className="py-24 md:py-32 section-band" id="algorithm">
      <Reveal>
        <AIEvaluationComparison />
      </Reveal>

      {/* Score section — merged into the same section, no border/gap break */}
      <div className="max-w-[1200px] mx-auto px-8">
        <div id="score" className="mt-8 md:mt-4">
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
