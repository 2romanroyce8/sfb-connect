"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { applyPreference, readPreference, type ThemePreference } from "@/lib/theme";

const ORDER: ThemePreference[] = ["dark", "light", "system"];
const LABEL: Record<ThemePreference, string> = { dark: "Dark", light: "Light", system: "System" };

/**
 * Theme switch (Roman, 2026-10-18). `compact` = icon button that cycles Dark → Light → System
 * (nav bars, sidebars); default = three labelled segments (Settings). Both are theme-aware
 * themselves through the same tokens as everything else.
 */
export default function ThemeToggle({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const [pref, setPref] = useState<ThemePreference>("dark");
  useEffect(() => { setPref(readPreference()); }, []);
  // Follow OS changes while on "system".
  useEffect(() => {
    if (pref !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)"); const on = () => applyPreference("system");
    mq.addEventListener("change", on); return () => mq.removeEventListener("change", on);
  }, [pref]);
  const set = (p: ThemePreference) => { setPref(p); applyPreference(p); };
  const Icon = pref === "light" ? Sun : pref === "system" ? Monitor : Moon;

  if (compact) {
    const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
    return (
      <button type="button" onClick={() => set(next)} title={`Theme: ${LABEL[pref]} — switch to ${LABEL[next]}`} aria-label={`Theme: ${LABEL[pref]}. Switch to ${LABEL[next]}`} className={`inline-flex items-center justify-center w-[40px] h-[40px] rounded-full text-white/[0.8] hover:text-white transition-colors ${className}`} style={{ border: "1px solid rgb(var(--w) / 0.14)", background: "rgb(var(--w) / 0.04)" }}>
        <Icon size={16} strokeWidth={1.9} />
      </button>
    );
  }
  return (
    <div role="radiogroup" aria-label="Appearance" className={`inline-flex items-center p-1 rounded-full ${className}`} style={{ background: "rgb(var(--w) / 0.06)", border: "1px solid rgb(var(--w) / 0.12)" }}>
      {ORDER.map((p) => { const I = p === "light" ? Sun : p === "system" ? Monitor : Moon; const on = pref === p; return (
        <button key={p} type="button" role="radio" aria-checked={on} onClick={() => set(p)} className="inline-flex items-center gap-1.5 h-[32px] px-3.5 rounded-full text-[12.5px] font-semibold transition-colors" style={{ background: on ? "rgb(var(--w))" : "transparent", color: on ? "rgb(var(--k))" : "rgb(var(--w) / 0.7)" }}>
          <I size={13} strokeWidth={2} />{LABEL[p]}
        </button>); })}
    </div>
  );
}
