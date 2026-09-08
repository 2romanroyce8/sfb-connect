import Reveal from "@/components/ui/Reveal";

export default function MoreThanPresenceSection() {
  return (
    <section className="py-24 md:py-32 px-6 border-t border-white/10">
      <div className="max-w-[900px] mx-auto text-center">
        <Reveal>
          <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-6 block">
            SFB Connects is more than AI Presence
          </span>
          <h2 className="text-[32px] sm:text-[42px] md:text-[52px] font-extrabold tracking-[-0.03em] leading-[1.1]">
            AI may be changing how customers discover businesses — but discovery is only the beginning.
          </h2>
          <p className="mt-6 text-[16px] leading-relaxed text-[#a3a3a8] max-w-[620px] mx-auto">
            SFB Connects builds the technology behind the rest of the journey.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[15px] md:text-[17px] font-medium text-white/70">
            <span>AI Presence</span>
            <Dot />
            <span>Websites</span>
            <Dot />
            <span>Automation</span>
            <Dot />
            <span>AI Reception</span>
            <Dot />
            <span>Growth</span>
          </div>
          <p className="mt-8 font-serif-accent italic text-[20px] md:text-[24px] text-white/90">
            One connected technology company.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function Dot() {
  return <span className="text-white/20">·</span>;
}
