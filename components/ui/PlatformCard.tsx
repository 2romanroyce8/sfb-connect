"use client";

import { motion } from "framer-motion";

export default function PlatformCard({ name }: { name: string }) {
  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ duration: 0.25 }}
      className="glass-edge rounded-2xl px-7 py-6 flex items-center justify-center min-w-[140px]"
    >
      <span className="text-lg font-semibold tracking-tight text-[#e4e4e7]">
        {name}
      </span>
    </motion.div>
  );
}
