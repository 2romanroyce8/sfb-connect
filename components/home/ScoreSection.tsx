import Reveal from "@/components/ui/Reveal";
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
          {/* Heading lives inside FirstSevenDays so it can carry the business name once the scan resolves it. */}
          <FirstSevenDays modules={modules} />
        </Reveal>
      </div>
    </section>
  );
}
