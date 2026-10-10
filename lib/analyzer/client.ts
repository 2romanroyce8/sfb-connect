"use client";

// Tiny shared store so the Hero form (input) and the 7-day punch list (output)
// can live in different components without prop drilling. Streams NDJSON from
// /api/analyze/first-7-days and exposes state via useSyncExternalStore.
import { useSyncExternalStore } from "react";
import type { Finding, ScanEvent, ScanMeta } from "./types";

export type ScanState = { phase: "idle" | "running" | "done" | "error"; query: string; meta: ScanMeta | null; findings: Finding[]; error: { code: string; message: string } | null; durationMs: number | null };
const IDLE: ScanState = { phase: "idle", query: "", meta: null, findings: [], error: null, durationMs: null };
let state: ScanState = IDLE;
const listeners = new Set<() => void>();
const set = (patch: Partial<ScanState>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
const getState = (): ScanState => state;

export function useScan(): ScanState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => IDLE);
}

export async function startScan(query: string): Promise<void> {
  if (state.phase === "running") return;
  set({ phase: "running", query, meta: null, findings: [], error: null, durationMs: null });
  try {
    const res = await fetch("/api/analyze/first-7-days", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query }) });
    if (!res.body) throw new Error("No response body.");
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const raw = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!raw) continue;
        const ev = JSON.parse(raw) as ScanEvent;
        if (ev.type === "meta") set({ meta: ev.meta });
        else if (ev.type === "finding") set({ findings: [...state.findings.filter((f) => f.check !== ev.finding.check), ev.finding] });
        else if (ev.type === "done") set({ phase: "done", durationMs: ev.durationMs });
        else if (ev.type === "error") set({ phase: "error", error: { code: ev.code, message: ev.message } });
      }
    }
    if (getState().phase === "running") set({ phase: "done" });
  } catch (e) {
    set({ phase: "error", error: { code: "failed", message: e instanceof Error ? e.message : "The scan failed." } });
  }
}
