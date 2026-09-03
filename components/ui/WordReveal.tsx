"use client";

import { motion, MotionValue, useTransform } from "framer-motion";

function Word({
  word,
  progress,
  range,
  highlight,
}: {
  word: string;
  progress: MotionValue<number>;
  range: [number, number];
  highlight?: boolean;
}) {
  const opacity = useTransform(progress, range, [0.15, 1]);
  return (
    <motion.span
      style={{
        opacity,
        color: highlight ? "#ffffff" : "hsl(var(--hero-subtitle))",
      }}
      className="inline-block mr-[0.28em]"
    >
      {word}
    </motion.span>
  );
}

export default function WordReveal({
  text,
  progress,
  highlightWords = [],
  className,
}: {
  text: string;
  progress: MotionValue<number>;
  highlightWords?: string[];
  className?: string;
}) {
  const words = text.split(" ");
  const lowerHighlights = highlightWords.map((w) =>
    w.toLowerCase().replace(/[^a-z]/g, "")
  );

  return (
    <p className={className}>
      {words.map((word, i) => {
        const start = i / words.length;
        const end = (i + 1) / words.length;
        const clean = word.toLowerCase().replace(/[^a-z]/g, "");
        return (
          <Word
            key={i}
            word={word}
            progress={progress}
            range={[start, end]}
            highlight={lowerHighlights.includes(clean)}
          />
        );
      })}
    </p>
  );
}
