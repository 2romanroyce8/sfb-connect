import Reveal from "@/components/ui/Reveal";

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
          <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-5 block">
            AI Discovery
          </span>
          <h2 className="text-[28px] sm:text-[36px] md:text-[44px] font-extrabold tracking-[-0.02em]">
            Built for the new discovery layer.
          </h2>
        </Reveal>
        <Reveal>
          <div className="flex flex-wrap gap-10 md:gap-12 justify-center items-center mt-12">
            {PLATFORMS.map((p) => (
              <div
                key={p}
                className="text-xl md:text-2xl font-semibold text-medium-gray tracking-tight hover:text-white transition-colors"
              >
                {p}
              </div>
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
