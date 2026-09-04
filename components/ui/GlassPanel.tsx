"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export default function GlassPanel({
  children,
  className,
  hover = false,
  as: Component = motion.div,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  as?: any;
}) {
  return (
    <Component
      className={cn("glass-edge rounded-[28px]", className)}
      whileHover={
        hover ? { y: -6, scale: 1.01, transition: { duration: 0.25 } } : undefined
      }
    >
      {children}
    </Component>
  );
}
