import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";
import ScoreRing from "@/components/ui/ScoreRing";

export default function ScoreSection() {
  return (
    <section className="py-24 md:py-32 section-band" id="score">
      <div className="max-w-[1200px] mx-auto px-8">
        <Reveal>
          <SectionHead
            label="Capability 01 — where your agent starts"
            title={
              <>
                Your AI{" "}
                <span className="font-serif-accent italic font-normal">
                  Presence Score.
                </span>
              </>
            }
            subtitle={<>This is the first job your agent does. <a href="#agent" className="underline underline-offset-2 text-white/[0.85]">Seven more when you&apos;re ready →</a></>}
          />
        </Reveal>
        <Reveal>
          <ScoreRing />
        </Reveal>
      </div>
    </section>
  );
}
