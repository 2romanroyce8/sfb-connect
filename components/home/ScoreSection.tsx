import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";
import FirstSevenDays from "@/components/home/FirstSevenDays";
import { fetchAgentModules } from "@/lib/agentProgram/modules";

/**
 * "Your Agent's First 7 Days" — replaces the presence-score-only output
 * (Roman, 2026-10-10). Capability statuses come from the database so the
 * "your agent would…" lines can never promise an unshipped capability.
 */
export default async function ScoreSection() {
  const modules = await fetchAgentModules();
  return (
    <section className="py-24 md:py-32 section-band scroll-mt-20" id="score">
      <div className="max-w-[1000px] mx-auto px-8">
        <Reveal>
          <SectionHead
            label="Your agent's first 7 days"
            title={
              <>
                What your agent{" "}
                <span className="font-serif-accent italic font-normal">would do first.</span>
              </>
            }
            subtitle={<>Real findings from public data, grouped by day. Live capabilities act in the trial; the rest tell you when they ship. <a href="#agent" className="underline underline-offset-2 text-white/[0.85]">See all 8 →</a></>}
          />
        </Reveal>
        <Reveal>
          <FirstSevenDays modules={modules} />
        </Reveal>
      </div>
    </section>
  );
}
