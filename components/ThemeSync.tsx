"use client";

import { useEffect } from "react";
import { applyPreference, readPreference } from "@/lib/theme";

/**
 * Re-applies the stored theme after hydration. The inline head script sets it before first paint,
 * but when React recovers from a hydration mismatch it re-renders the root and can drop attributes
 * the script added (seen on /team/dashboard, 2026-10-18). Mounted once in app/layout.tsx; renders nothing.
 */
export default function ThemeSync() {
  useEffect(() => { applyPreference(readPreference()); }, []);
  return null;
}
