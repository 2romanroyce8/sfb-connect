import Link from "next/link";

export default function Hero() {
  return (
    <section className="min-h-screen flex flex-col justify-center pt-36 pb-20 relative bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(255,255,255,0.08),transparent_60%)]">
      <div className="max-w-[1200px] mx-auto px-8 w-full">
        <div className="flex items-center gap-2.5 font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-7">
          <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
          AI PRESENCE / 2026
        </div>
        <h1 className="text-[44px] sm:text-[64px] md:text-[84px] lg:text-[108px] font-extrabold leading-[1.02] tracking-[-0.03em] max-w-[1000px]">
          Your customers
          <br />
          are asking AI
          <br />
          <span className="bg-gradient-to-b from-white to-[#a0a0a5] bg-clip-text text-transparent">
            who to choose.
          </span>
        </h1>
        <div className="text-[28px] sm:text-[40px] md:text-[52px] font-bold tracking-[-0.02em] mt-3 text-medium-gray">
          Make sure it can find you.
        </div>
        <p className="max-w-[560px] text-lg leading-relaxed text-[#c7c7cc] mt-8">
          We analyze and optimize how your business is represented across the
          digital signals AI systems can use when answering local and
          commercial recommendations.
        </p>
        <div className="flex items-center gap-5 mt-11 flex-wrap">
          <Link
            href="#pricing"
            className="bg-white text-black px-8 py-4 rounded-full text-base font-semibold inline-flex items-center gap-2 hover:scale-[1.03] transition-transform"
          >
            Analyze My Business →
          </Link>
          <Link
            href="#process"
            className="glass text-white px-8 py-4 rounded-full text-base font-medium hover:bg-white/10 transition-colors"
          >
            How AI Discovery Works
          </Link>
        </div>
        <div className="mt-14 flex items-baseline gap-4 flex-wrap">
          <div className="font-mono text-xl font-semibold tracking-wide">
            $200 / YEAR
          </div>
          <div className="text-[13px] text-medium-gray">
            One annual payment. No monthly subscription.
          </div>
        </div>
      </div>
    </section>
  );
}
