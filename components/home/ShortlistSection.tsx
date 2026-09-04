import Reveal from "@/components/ui/Reveal";
import SectionLabel from "@/components/ui/SectionLabel";
import EditorialHeading from "@/components/ui/EditorialHeading";
import RecommendationRow from "@/components/ui/RecommendationRow";
import AmbientOrb from "@/components/ui/AmbientOrb";

const rows = [
  { name: "Your Business", tag: "RECOMMENDED", you: true },
  { name: "Business B" },
  { name: "Business C" },
  { name: "Business D" },
  { name: "Business E" },
];

export default function ShortlistSection() {
  return (
    <section className="py-24 md:py-32 section-band" id="shortlist">
      <div className="max-w-[1200px] mx-auto px-8">
        <Reveal>
          <SectionLabel>The Shortlist</SectionLabel>
          <EditorialHeading className="mb-6">
            Hundreds of businesses exist.
            <br />
            The customer may only see five.
          </EditorialHeading>
          <p className="mt-5 text-[17px] leading-relaxed text-[#a3a3a8] max-w-[640px] mb-16">
            When an AI assistant generates a shortlist, every business
            outside that shortlist risks becoming invisible during that
            decision.
          </p>
        </Reveal>
        <Reveal>
          <div className="glass-edge relative overflow-hidden rounded-[36px] p-8 md:p-11">
            <AmbientOrb color="cyan" size={240} className="-top-20 -right-10" />
            <div className="relative z-10">
              <div className="font-mono text-sm text-medium-gray border border-white/10 rounded-full px-5 py-2.5 inline-flex mb-8">
                &quot;What&apos;s the best junk removal company near me?&quot;
              </div>
              <div className="flex flex-col gap-3">
                {rows.map((row, i) => (
                  <RecommendationRow
                    key={row.name}
                    rank={String(i + 1).padStart(2, "0")}
                    name={row.name}
                    badge={row.tag}
                    highlight={row.you}
                  />
                ))}
              </div>
              <div className="mt-5 text-center text-[13.5px] text-medium-gray font-mono">
                + 247 other businesses the customer never compared
              </div>
            </div>
          </div>
        </Reveal>
        <Reveal>
          <p className="mt-12 text-xl md:text-2xl font-semibold leading-relaxed max-w-[680px]">
            SFB Connect is built to make your business a stronger candidate
            for AI-powered discovery.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
