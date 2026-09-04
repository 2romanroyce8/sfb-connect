"use client";

import { motion } from "framer-motion";

export default function OrbitalNode({
  label,
  x,
  y,
  delay = 0,
}: {
  label: string;
  x: number;
  y: number;
  delay?: number;
}) {
  return (
    <motion.div
      className="absolute font-mono text-[12.5px] glass-edge rounded-full px-4 py-2 whitespace-nowrap -translate-x-1/2 -translate-y-1/2"
      style={{ left: x, top: y }}
      animate={{ y: [0, -8, 0] }}
      transition={{
        duration: 6 + delay,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
    >
      {label}
    </motion.div>
  );
}
