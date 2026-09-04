"use client";

import { motion } from "framer-motion";

const COLORS = {
  cyan: "#46C7FF",
  violet: "#9B6CFF",
  green: "#67F2A3",
  warm: "#FF8D65",
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
