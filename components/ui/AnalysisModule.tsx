"use client";

import { motion } from "framer-motion";

export default function AnalysisModule({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ duration: 0.25 }}
      className="glass-edge rounded-[28px] p-8 flex flex-col h-full"
    >
      <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-medium-gray mb-6">
        {title}
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item} className="text-[14px] text-[#d4d4d8] leading-snug">
            {item}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
