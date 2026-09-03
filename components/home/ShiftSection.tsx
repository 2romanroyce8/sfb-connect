import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";

export default function ShiftSection() {
  return (
    <section className="py-24 md:py-32 section-band" id="shift">
      <div className="max-w-[1200px] mx-auto px-8">
        <Reveal>
          <SectionHead
            label="The Shift"
            title={
              <>
                Search gave people choices.
                <br />
                AI gives people{" "}
                <span className="font-serif-accent italic font-normal">
                  answers.
                </span>
              </>
            }
          />
        </Reveal>
        <Reveal>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="glass rounded-[28px] p-10">
              <div className="font-mono text-[15px] text-medium-gray mb-5">
                2016
              </div>
              <div className="text-xl font-semibold mb-7 leading-snug">
                &quot;best plumber near me&quot;
              </div>
              <div className="flex flex-col gap-2">
                {[100, 100, 60, 100, 55].map((w, i) => (
                  <div
                    key={i}
                    className="h-[11px] rounded-md bg-white/[0.08]"
                    style={{ width: `${w}%` }}
                  />
                ))}
              </div>
              <div className="mt-4 text-[13px] text-medium-gray font-mono">
                Pages of search results
              </div>
            </div>
            <div className="glass rounded-[28px] p-10">
              <div className="font-mono text-[15px] text-medium-gray mb-5">
                2026
              </div>
              <div className="text-xl font-semibold mb-7 leading-snug">
                &quot;Who is the best plumber near me?&quot;
              </div>
              <div className="bg-white/[0.05] border border-white/10 rounded-2xl p-5 text-[14.5px] leading-relaxed text-[#d4d4d8]">
                Based on service area, reviews, and specialty match, here are
                three well-suited plumbers near you:{" "}
                <strong>Acme Plumbing</strong>,{" "}
                <strong>Rapid Rooter Co.</strong>, and{" "}
                <strong>Metro Pipe Works</strong>.
              </div>
              <div className="mt-4 text-[13px] text-medium-gray font-mono">
                A short AI-generated recommendation set
              </div>
            </div>
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
