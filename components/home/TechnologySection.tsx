import Reveal from "@/components/ui/Reveal";

export default function TechnologySection() {
  return (
    <section className="pt-20 md:pt-28 pb-4 px-6" id="technology">
      <div className="max-w-[820px] mx-auto text-center">
        <Reveal>
          <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-6 block">
            SFB Connect / Technology
          </span>
          <h2 className="text-[34px] sm:text-[44px] md:text-[56px] font-extrabold tracking-[-0.03em] leading-[1.05]">
            One technology partner.
            <br />
            From <span className="font-serif-accent italic font-normal">discovery</span> to conversion.
          </h2>
          <p className="mt-6 text-[16px] md:text-[18px] leading-relaxed text-[#a3a3a8] max-w-[680px] mx-auto">
            SFB Connect helps businesses build the digital infrastructure needed for the AI era —
            from AI Presence and high-performance websites to automation, AI-powered customer
            communication and growth systems.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
