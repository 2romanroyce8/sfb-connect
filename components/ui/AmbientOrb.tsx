"use client";

import { motion } from "framer-motion";

const COLORS = {
  cyan: "var(--hx-46c7ff)",
  violet: "var(--hx-9b6cff)",
  green: "var(--hx-67f2a3)",
  warm: "var(--hx-ff8d65)",
};

export default function AmbientOrb({
  color = "cyan",
  size = 320,
  className = "",
  duration = 12,
}: {
  color?: keyof typeof COLORS;
  size?: number;
  className?: string;
  duration?: number;
}) {
  return (
    <motion.div
      aria-hidden
      className={`ambient-glow rounded-full absolute ${className}`}
      style={{
        width: size,
        height: size,
        background: COLORS[color],
      }}
      animate={{
        x: [0, 18, -12, 0],
        y: [0, -14, 10, 0],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}
