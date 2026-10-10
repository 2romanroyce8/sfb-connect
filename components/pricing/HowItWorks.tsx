import { HOW_IT_WORKS, HOW_IT_WORKS_HEADLINE, HOW_IT_WORKS_SUBLINE } from "@/lib/agentProgram/pricing";

/** §1 — three steps, every number from config. */
export default function HowItWorks() {
  return (
    <section className="px-6 pt-[140px] md:pt-[170px] pb-16 md:pb-20" id="how">
      <div className="max-w-[1100px] mx-auto">
        <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#30D158] mb-5">How it works</div>
        <h1 className="text-[44px] sm:text-[60px] md:text-[76px] font-bold leading-[0.95] tracking-[-0.045em] max-w-[900px]">{HOW_IT_WORKS_HEADLINE}</h1>
        <p className="mt-6 text-[18px] md:text-[22px] leading-[1.45] text-white/[0.7] max-w-[760px]">{HOW_IT_WORKS_SUBLINE}</p>
        <div className="mt-12 grid md:grid-cols-3 gap-4">
          {HOW_IT_WORKS.map((s) => (
            <div key={s.n} className="rounded-[18px] p-6 flex flex-col" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[14px] font-semibold text-black bg-white">{s.n}</div>
              <div className="mt-5 text-[20px] font-semibold tracking-[-0.02em] text-white">{s.title}</div>
              <div className="mt-1.5 text-[15px] text-white/[0.82]">{s.price}</div>
              <p className="mt-3 text-[13.5px] leading-[1.55] text-white/[0.55]">{s.body}</p>
              <div className="mt-auto pt-5 text-[12.5px] font-medium text-[#30D158]">{s.tag}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
