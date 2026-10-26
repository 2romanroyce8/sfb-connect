"use client";
import { useState } from "react";

type Check = { id: string; label: string; result: "pass" | "warn" | "fail"; evidence: string; confidence: "high" | "medium" };
type Report = { url: string; status: number; fetchedMs: number; truncated: boolean; summary: { pass: number; warn: number; fail: number; total: number }; checks: Check[]; note: string };
const tone = { pass: { t: "Pass", c: "var(--mk-blue2)" }, warn: { t: "Needs work", c: "var(--mk-muted)" }, fail: { t: "Fix", c: "var(--mk-text)" } } as const;

// A REAL audit of a public page the visitor enters, run on our server. Every row shows the evidence found in the page; nothing is estimated.
export default function AuditPanel({ onRun }: { onRun?: () => void }) {
  const [url, setUrl] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [rep, setRep] = useState<Report | null>(null);
  async function run(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null); setRep(null); onRun?.();
    try { const r = await fetch("/api/demo/audit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "That didn't work."); setRep(j as Report); }
    catch (x) { setErr(x instanceof Error ? x.message : "That didn't work."); } finally { setBusy(false); }
  }
  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap"><span className="mk-sim" style={{ borderStyle: "solid" }}>Live check</span><span className="text-[13.5px]" style={{ color: "var(--mk-muted)" }}>Enter any public website. We read the page and report only what the HTML actually contains, with the evidence.</span></div>
      <form onSubmit={run} className="flex gap-2 flex-wrap">
        <input className="mk-input" style={{ flex: "1 1 260px" }} placeholder="yourclient.com" aria-label="Website address" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" autoComplete="off" />
        <button disabled={busy || url.trim().length < 3} className="mk-btn mk-btn-primary disabled:opacity-50">{busy ? "Checking…" : "Run audit"}</button>
      </form>
      {err && <div role="alert" className="mt-3 text-[13.5px]" style={{ color: "var(--mk-blue2)" }}>{err}</div>}
      {rep && (
        <div className="mt-5" aria-live="polite">
          <div className="text-[13.5px] mb-3" style={{ color: "var(--mk-muted)" }}>Audited <strong style={{ color: "var(--mk-text)" }}>{rep.url}</strong> · {rep.summary.pass} pass, {rep.summary.warn} need work, {rep.summary.fail} to fix · {(rep.fetchedMs / 1000).toFixed(1)}s</div>
          <div className="rounded-[18px] overflow-hidden" style={{ border: "1px solid var(--mk-border)" }}>
            {rep.checks.map((c, i) => (
              <div key={c.id} className="grid grid-cols-[1fr_auto] md:grid-cols-[190px_110px_1fr] gap-x-4 gap-y-1 px-5 py-3.5 text-[14.5px]" style={{ borderTop: i ? "1px solid var(--mk-border)" : "none", background: i % 2 ? "var(--mk-bg2)" : "var(--mk-white)" }}>
                <span className="font-medium">{c.label}</span><span className="font-semibold" style={{ color: tone[c.result].c }}>{tone[c.result].t}</span>
                <span className="col-span-2 md:col-span-1" style={{ color: "var(--mk-muted)" }}>{c.evidence}{c.confidence === "medium" ? " (medium confidence)" : ""}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12.5px]" style={{ color: "var(--mk-muted)" }}>{rep.note}{rep.truncated ? " The page was large, so only the first part was read." : ""}</p>
        </div>
      )}
    </div>
  );
}
