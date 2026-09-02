import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";
import ScoreRing from "@/components/ui/ScoreRing";

export default function ScoreSection() {
  return (
    <section className="py-24 md:py-32 section-band" id="score">
      <div className="max-w-[1200px] mx-auto px-8">
        <Reveal>
          <SectionHead label="The Diagnostic" title="Your AI Presence Score." />
        </Reveal>
        <Reveal>
          <ScoreRing />
        </Reveal>
      </div>
    </section>
  );
}
