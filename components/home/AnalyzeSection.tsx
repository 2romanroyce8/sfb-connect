import { Fingerprint, BookOpen, ShieldCheck, Code2 } from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";
import NeonCard from "@/components/ui/NeonCard";

const GROUPS = [
  {
    title: "Identity",
    description: "Business entity clarity, NAP consistency, and geographic relevance.",
    icon: Fingerprint,
    borderGradient:
      "linear-gradient(135deg, #FF4E78 0%, #FF55A7 25%, #FF9352 62%, #FFD35A 100%)",
    glowGradient:
      "linear-gradient(135deg, rgba(255,78,120,0.65), rgba(255,147,82,0.5), rgba(255,211,90,0.35))",
  },
  {
    title: "Knowledge",
    description: "Service and product definitions, FAQs, and knowledge consistency.",
    icon: BookOpen,
    borderGradient:
      "linear-gradient(135deg, #FF8FA0 0%, #E9F5FF 22%, #55D8FF 55%, #00C7F4 100%)",
    glowGradient:
      "linear-gradient(135deg, rgba(255,143,160,0.35), rgba(90,216,255,0.55), rgba(0,199,244,0.5))",
  },
  {
    title: "Authority",
    description: "Public citations, review signals, and competitive positioning.",
    icon: ShieldCheck,
    borderGradient:
      "linear-gradient(135deg, #665CFF 0%, #7859FF 35%, #B965FF 70%, #FF8DDC 100%)",
    glowGradient:
      "linear-gradient(135deg, rgba(102,92,255,0.55), rgba(185,101,255,0.55), rgba(255,141,220,0.4))",
  },
  {
    title: "Machine Readability",
    description: "Structured data, schema markup, and source freshness.",
    icon: Code2,
    borderGradient:
      "linear-gradient(135deg, #34D399 0%, #22D3EE 55%, #A7F3D0 100%)",
    glowGradient:
      "linear-gradient(135deg, rgba(52,211,153,0.55), rgba(34,211,238,0.5), rgba(167,243,208,0.35))",
  },
];

export default function AnalyzeSection() {
  return (
    <section className="py-24 md:py-32 section-band" id="analyze">
      <div className="max-w-[1200px] mx-auto px-8">
        <Reveal>
          <SectionHead label="The Scope" title="What We Analyze" />
        </Reveal>
        <Reveal>
          <div className="neon-cards-wrap">
            {GROUPS.map((g) => (
              <NeonCard
                key={g.title}
                icon={g.icon}
                title={g.title}
                description={g.description}
                borderGradient={g.borderGradient}
                glowGradient={g.glowGradient}
              />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
