// "Your Agent's First 7 Days" analyzer — shared types.
// Every finding is evidence-backed or explicitly `missing` with a reason.
// A missing row beats a made-up row (Roman, 2026-10-10).
import type { CapabilityKey } from "@/lib/agentProgram/config";

export type CheckKey = "presence" | "outbound" | "reviews" | "website" | "chat";

export type Finding = {
  check: CheckKey;
  capability: CapabilityKey;
  /** "found": real numbers below. "missing": we could not measure — `reason` says why. */
  status: "found" | "missing";
  /** One-line, number-first statement of what we found (no agent promise here). */
  headline: string;
  /** Specific items (fixes, errors, competitor names). Empty when nothing specific. */
  items: string[];
  /** Why we couldn't measure (status=missing) or caveats on the numbers (status=found). */
  reason: string | null;
  /** Raw numbers for the UI/tests. */
  metrics: Record<string, number | string | null>;
  /** Where the evidence came from. */
  sources: string[];
};

export type ScanMeta = { domain: string; url: string; /** Exactly what the visitor typed (shown as "Analyzed: …"). */ enteredQuery?: string; businessName: string | null; nameSource?: "title" | "jsonld" | "lookup" | null; logoUrl?: string | null; category: string | null; market: string | null; cached: boolean; startedAt: string; /** Operator diagnostics (not rendered): where category/market came from, fetch facts. */ debug?: Record<string, string | number | boolean | null> };

export type ScanEvent =
  | { type: "meta"; meta: ScanMeta }
  | { type: "finding"; finding: Finding }
  | { type: "done"; durationMs: number }
  | { type: "error"; code: "needs_link" | "unreachable" | "rate_limited" | "failed"; message: string };

export type StoredScan = { meta: ScanMeta; findings: Finding[] };
