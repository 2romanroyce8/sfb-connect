import Reveal from "@/components/ui/Reveal";
import SectionLabel from "@/components/ui/SectionLabel";
import EditorialHeading from "@/components/ui/EditorialHeading";
import PlatformCard from "@/components/ui/PlatformCard";

const PLATFORMS = [
  "ChatGPT",
  "Claude",
  "Perplexity",
  "Grok",
  "Gemini",
  "AI Search",
  "AI Assistants",
];

export default function PlatformsSection() {
  return (
    <section className="py-24 md:py-28 section-band" id="platforms">
      <div className="max-w-[1200px] mx-auto px-8 text-center">
        <Reveal>
          <SectionLabel>AI Discovery</SectionLabel>
          <EditorialHeading size="md">
            Built for the new discovery layer.
          </EditorialHeading>
        </Reveal>
        <Reveal>
          <div className="flex flex-wrap gap-4 justify-center items-center mt-14">
            {PLATFORMS.map((p) => (
              <PlatformCard key={p} name={p} />
            ))}
          </div>
        </Reveal>
        <Reveal>
          <p className="text-center text-[12.5px] text-[#5c5c60] mt-12 max-w-[520px] mx-auto leading-relaxed">
            SFB Connect is not affiliated with, certified by, or partnered
            with the platforms named above. Names are shown to describe the
            discovery ecosystem this service addresses.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
