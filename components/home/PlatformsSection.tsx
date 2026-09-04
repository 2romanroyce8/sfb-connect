import Reveal from "@/components/ui/Reveal";
import { Search, Bot } from "lucide-react";

const PLATFORMS: { name: string; logo?: string }[] = [
  { name: "ChatGPT", logo: "https://pub.hyperagent.com/api/published/pbf01M1PETQF1_GKWEVZM81T4F7F3S/logo-chatgpt.png" },
  { name: "Claude", logo: "https://pub.hyperagent.com/api/published/pbf01M1PETRF8_1VFNQ24D15D436CX/logo-claude.png" },
  { name: "Perplexity", logo: "https://pub.hyperagent.com/api/published/pbf01M1PETS6Q_3S0CNHDN0W2C8QKA/logo-perplexity.png" },
  { name: "Grok", logo: "https://pub.hyperagent.com/api/published/pbf01M1PETSN3_WRD1VYQ7QCSEHAP8/logo-grok.png" },
  { name: "Gemini", logo: "https://pub.hyperagent.com/api/published/pbf01M1PETT0N_69SGZJMWZP0BTXWH/logo-gemini.png" },
  { name: "AI Search" },
  { name: "AI Assistants" },
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
          <div className="flex flex-wrap gap-10 md:gap-14 justify-center items-start mt-14">
            {PLATFORMS.map((p) => (
              <div
                key={p.name}
                className="flex flex-col items-center gap-3 w-[92px]"
              >
                <div className="w-12 h-12 flex items-center justify-center">
                  {p.logo ? (
                    <img
                      src={p.logo}
                      alt={p.name}
                      className="max-w-full max-h-full object-contain opacity-80 hover:opacity-100 transition-opacity"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full border border-white/15 flex items-center justify-center text-medium-gray">
                      {p.name === "AI Search" ? (
                        <Search className="w-5 h-5" strokeWidth={1.75} />
                      ) : (
                        <Bot className="w-5 h-5" strokeWidth={1.75} />
                      )}
                    </div>
                  )}
                </div>
                <span className="text-sm font-semibold text-medium-gray tracking-tight hover:text-white transition-colors">
                  {p.name}
                </span>
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal>
          <p className="text-center text-[12.5px] text-[#5c5c60] mt-14 max-w-[520px] mx-auto leading-relaxed">
            SFB Connect is not affiliated with, certified by, or partnered
            with the platforms named above. Logos and names are shown to
            describe the discovery ecosystem this service addresses.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
