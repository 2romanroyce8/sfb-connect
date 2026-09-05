import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";
import AIEvaluationComparison from "@/components/ui/AIEvaluationComparison";
import ScoreRing from "@/components/ui/ScoreRing";

export default function AlgorithmSection() {
  return (
    <section className="py-24 md:py-32 section-band" id="algorithm">
      <div className="max-w-[1200px] mx-auto px-8">
        <Reveal>
          <AIEvaluationComparison />
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
