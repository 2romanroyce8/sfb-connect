import Reveal from "@/components/ui/Reveal";
import SectionLabel from "@/components/ui/SectionLabel";
import EditorialHeading from "@/components/ui/EditorialHeading";
import AnalysisModule from "@/components/ui/AnalysisModule";

const GROUPS = [
  {
    title: "Identity",
    items: [
      "Business entity clarity",
      "Name / address / phone consistency",
      "Business descriptions",
      "Local business information",
      "Geographic relevance",
    ],
  },
  {
    title: "Knowledge",
    items: [
      "Service definitions",
      "Product definitions",
      "Frequently asked questions",
      "AI-readable service information",
      "Knowledge consistency",
    ],
  },
  {
    title: "Authority",
    items: [
      "Public citations",
      "Social profiles",
      "Review signals",
      "Authority signals",
      "Competitive positioning",
    ],
  },
  {
    title: "Machine Readability",
    items: [
      "Website information architecture",
      "Structured data",
      "Schema markup",
      "Source freshness",
      "Entity relationships",
    ],
  },
];

export default function AnalyzeSection() {
  return (
    <section className="py-24 md:py-32 section-band" id="analyze">
      <div className="max-w-[1200px] mx-auto px-8">
        <Reveal>
          <SectionLabel>The Scope</SectionLabel>
          <EditorialHeading className="mb-16">What We Analyze</EditorialHeading>
        </Reveal>
        <Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {GROUPS.map((g) => (
              <AnalysisModule key={g.title} title={g.title} items={g.items} />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
