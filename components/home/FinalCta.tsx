"use client";

import Link from "next/link";
import Reveal from "@/components/ui/Reveal";

const BG_SRC =
  "https://pub.hyperagent.com/api/published/pbf01M1PYE7MN_BNVYVBE1D6Z2DECN/crystal_frame.jpg";
const LOGO_SRC =
  "https://pub.hyperagent.com/api/published/pbf01M20H817H_JC6RBZ3RQ3YAXVV2/sfb_logo_mark_cropped.png";

export default function FinalCta() {
  return (
    <section className="relative text-center py-32 md:py-40 border-t border-white/10 overflow-hidden">
      <div
        className="absolute inset-0 w-full h-full bg-cover bg-center z-0"
        style={{ backgroundImage: `url(${BG_SRC})` }}
      />
      <div className="absolute inset-0 bg-black/45 z-[1]" />

      <div className="relative z-10 max-w-[1200px] mx-auto px-8">
        <Reveal>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="SFB Connect" className="w-10 h-auto mx-auto mb-8" />

          <div className="inline-flex flex-wrap items-center justify-center gap-x-5 gap-y-1 mb-10 px-5 py-2.5 rounded-full text-[12.5px] text-white/[0.7]" style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)" }}>
            <span>Cancel anytime</span><span className="text-white/[0.3]">·</span><span>Month-to-month</span><span className="text-white/[0.3]">·</span><span>No contracts</span>
          </div>
          <h2 className="text-[36px] sm:text-[48px] md:text-[68px] font-serif-accent italic font-normal tracking-[-0.01em] max-w-[900px] mx-auto leading-[1.08]">
            Your competitors&apos; agents are already working. Get yours.
          </h2>
          <p className="text-medium-gray text-lg mt-6 max-w-[560px] mx-auto">
            Free on a sample business today. Live on yours when you&apos;re ready.
          </p>
          <div className="font-mono text-2xl text-medium-gray my-9">
            Plans from $19.99 / month <span className="text-base align-middle text-medium-gray/70">(introductory)</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/start" className="bg-white text-black px-8 py-4 rounded-full text-base font-semibold inline-flex items-center gap-2 hover:scale-[1.03] transition-transform">Try it free →</Link>
            <Link href="#pricing" className="px-8 py-4 rounded-full text-base font-medium inline-flex items-center gap-2 text-white hover:bg-white/[0.05] transition-colors" style={{ border: "1px solid rgba(255,255,255,0.2)" }}>See plans →</Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
