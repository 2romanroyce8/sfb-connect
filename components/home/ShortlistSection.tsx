import Reveal from "@/components/ui/Reveal";
import SectionHead from "@/components/home/SectionHead";

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
          <SectionHead
            label="The Shortlist"
            title={
              <>
                Hundreds of businesses exist.
                <br />
                The customer may only see five.
              </>
            }
            description="When an AI assistant generates a shortlist, every business outside that shortlist risks becoming invisible during that decision."
          />
        </Reveal>
        <Reveal>
          <div className="glass rounded-[28px] p-8 md:p-11">
            <div className="font-mono text-sm text-medium-gray border border-white/10 rounded-full px-5 py-2.5 inline-flex mb-8">
              &quot;What&apos;s the best junk removal company near me?&quot;
            </div>
            <div className="flex flex-col gap-3">
              {rows.map((row, i) => (
                <div
                  key={row.name}
                  className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-colors ${
                    row.you
                      ? "bg-white/10 border border-white/40"
                      : "bg-white/[0.04] border border-transparent hover:bg-white/[0.08]"
                  }`}
                >
                  <span className="font-mono text-sm text-medium-gray w-7">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[15px] font-medium flex-1">
                    {row.name}
                  </span>
                  {row.tag && (
                    <span className="font-mono text-[11px] text-black bg-white px-2.5 py-1 rounded-full font-semibold">
                      {row.tag}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-5 text-center text-[13.5px] text-medium-gray font-mono">
              + 247 other businesses the customer never compared
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
