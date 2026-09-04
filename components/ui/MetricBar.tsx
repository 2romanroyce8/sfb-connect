"use client";

import { useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export default function MetricBar({ name, value }: { name: string; value: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let cur = 0;
    const interval = setInterval(() => {
      cur += 2;
      if (cur >= value) {
        setDisplay(value);
        clearInterval(interval);
      } else {
        setDisplay(cur);
      }
    }, 16);
    return () => clearInterval(interval);
  }, [inView, value]);

  return (
    <div ref={ref} className="flex items-center gap-5">
      <span className="w-[170px] shrink-0 text-[14.5px] text-[#d4d4d8]">{name}</span>
      <div className="flex-1 h-1.5 rounded-md bg-white/[0.08] overflow-hidden">
        <motion.div
          className="h-full bg-white rounded-md"
          initial={{ width: "0%" }}
          animate={{ width: inView ? `${value}%` : "0%" }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
      </div>
      <span className="font-mono text-sm text-medium-gray w-8 text-right">{display}</span>
    </div>
  );
}
