import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";
import { AUDIT_CATEGORIES } from "@/lib/types";

export default function AnalyzeSection() {
  return (
    <section className="py-24 md:py-32 section-band" id="analyze">
      <div className="max-w-[1200px] mx-auto px-8">
        <Reveal>
          <SectionHead label="The Scope" title="What We Analyze" />
        </Reveal>
        <Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {AUDIT_CATEGORIES.map((c) => (
              <div
                key={c}
                className="border border-white/10 rounded-2xl px-5 py-4.5 text-sm text-[#d4d4d8] bg-white/[0.03]"
              >
                {c}
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
