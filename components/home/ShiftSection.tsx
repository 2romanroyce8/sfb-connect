import Reveal from "@/components/ui/Reveal";
import SectionLabel from "@/components/ui/SectionLabel";
import EditorialHeading, { Accent } from "@/components/ui/EditorialHeading";
import ComparisonPanel from "@/components/ui/ComparisonPanel";

export default function ShiftSection() {
  return (
    <section className="py-24 md:py-32 section-band" id="shift">
      <div className="max-w-[1200px] mx-auto px-8">
        <Reveal>
          <SectionLabel>The Shift</SectionLabel>
          <EditorialHeading className="mb-16">
            Search gave people choices.
            <br />
            AI gives people <Accent>answers.</Accent>
          </EditorialHeading>
        </Reveal>
        <Reveal>
          <div className="grid md:grid-cols-2 gap-6">
            <ComparisonPanel
              year="2016"
              query={`"best plumber near me"`}
              caption="Pages of search results"
            >
              <div className="flex flex-col gap-2">
                {[100, 100, 60, 100, 55].map((w, i) => (
                  <div
                    key={i}
                    className="h-[11px] rounded-md bg-white/[0.08]"
                    style={{ width: `${w}%` }}
                  />
                ))}
              </div>
            </ComparisonPanel>

            <ComparisonPanel
              year="2026"
              query={`"Who is the best plumber near me?"`}
              caption="A short AI-generated recommendation set"
              emphasized
            >
              <div className="bg-white/[0.05] border border-white/10 rounded-2xl p-5 text-[14.5px] leading-relaxed text-[#d4d4d8]">
                Based on service area, reviews, and specialty match, here are
                three well-suited plumbers near you:{" "}
                <strong>Acme Plumbing</strong>,{" "}
                <strong>Rapid Rooter Co.</strong>, and{" "}
                <strong>Metro Pipe Works</strong>.
              </div>
            </ComparisonPanel>
          </div>
        </Reveal>
        <Reveal>
          <p className="mt-14 text-lg md:text-xl leading-relaxed text-[#c7c7cc] max-w-[760px]">
            That difference changes the competition. If AI narrows a market
            from hundreds of companies to a handful of recommendations, being
            understandable to AI becomes a business advantage.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
