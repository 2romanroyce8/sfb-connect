import Link from "next/link";
import Reveal from "@/components/ui/Reveal";

export default function FinalCta() {
  return (
    <section className="text-center py-32 md:py-40">
      <div className="max-w-[1200px] mx-auto px-8">
        <Reveal>
          <div className="flex justify-center items-center gap-2.5 font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-7">
            YOUR CUSTOMERS ARE ALREADY ASKING.
          </div>
          <h2 className="text-[36px] sm:text-[48px] md:text-[68px] font-extrabold tracking-[-0.03em] max-w-[800px] mx-auto leading-[1.08]">
            Make sure AI knows who you are.
          </h2>
          <div className="font-mono text-2xl text-medium-gray my-9">
            $200 / YEAR
          </div>
          <Link
            href="#pricing"
            className="bg-white text-black px-8 py-4 rounded-full text-base font-semibold inline-flex items-center gap-2 hover:scale-[1.03] transition-transform"
          >
            Analyze My Business →
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
