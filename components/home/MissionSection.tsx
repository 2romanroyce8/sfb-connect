"use client";

import { useRef } from "react";
import { useScroll } from "framer-motion";
import WordReveal from "@/components/ui/WordReveal";

const PARAGRAPH_1 =
  "We built SFB Connect because being online isn't enough anymore — your business needs to be understandable to the machines helping customers decide who to call.";

const PARAGRAPH_2 =
  "Clear identity, consistent information, and machine-readable structure — that's what turns a business AI can see into a business AI recommends.";

export default function MissionSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  return (
    <section ref={ref} className="pt-24 md:pt-32 pb-24 md:pb-32 px-6">
      <div className="max-w-4xl mx-auto flex flex-col items-center">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full max-w-[560px] aspect-square object-cover rounded-3xl mb-16 opacity-90"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_132944_a0d124bb-eaa1-4082-aa30-2310efb42b4b.mp4"
        />

        <WordReveal
          text={PARAGRAPH_1}
          progress={scrollYProgress}
          highlightWords={["understandable", "machines", "decide"]}
          className="text-2xl md:text-4xl lg:text-5xl font-bold tracking-[-1px] text-center leading-tight"
        />

        <WordReveal
          text={PARAGRAPH_2}
          progress={scrollYProgress}
          className="text-xl md:text-2xl lg:text-3xl font-semibold text-center leading-snug mt-10"
        />
      </div>
    </section>
  );
}
