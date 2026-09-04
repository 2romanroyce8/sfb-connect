"use client";

import { motion } from "framer-motion";
import AmbientOrb from "@/components/ui/AmbientOrb";

export default function PosterSection() {
  return (
    <section className="relative py-32 md:py-48 px-8 section-band overflow-hidden">
      <div className="max-w-[1200px] mx-auto grid md:grid-cols-2 gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.65, ease: "easeOut" }}
        >
          <span className="font-mono text-xs tracking-[0.28em] uppercase text-medium-gray mb-8 block">
            Visibility
          </span>
          <h2 className="text-[52px] sm:text-[72px] md:text-[92px] font-extrabold tracking-[-0.03em] leading-[0.94]">
            GET
            <br />
            FOUND
            <br />
            <span className="font-serif-accent italic font-normal">
              before
            </span>
            <br />
            YOUR
            <br />
            COMPETITOR
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative h-[420px] md:h-[520px] flex items-center justify-center"
        >
          <AmbientOrb color="cyan" size={260} className="left-[10%] top-[10%]" duration={10} />
          <AmbientOrb color="green" size={220} className="right-[8%] bottom-[15%]" duration={14} />
          <motion.div
            className="glass-edge w-[220px] h-[420px] md:w-[260px] md:h-[500px] rounded-[120px]"
            animate={{ rotate: [0, 3, -3, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </div>
    </section>
  );
}
