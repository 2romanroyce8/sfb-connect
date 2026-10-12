"use client";

import { useState } from "react";
import type { Cap } from "../OnboardingShell";

const PLAIN: Record<string, string> = {
  ai_presence: "Gets your business recommended when people ask ChatGPT, Perplexity, Gemini or Claude.",
  outbound_gtm: "Finds the buyers you describe, writes to them, follows up, and books the call — every message approved by you first.",
  meta_ads: "Runs and tunes your Facebook / Instagram ads for return, not clicks.",
  website: "Keeps your site fast, findable and able to take payments.",
  crm_automations: "Never drops a lead: pipeline, reminders, follow-up, missed-call text-back.",
  chat_texting: "Answers website chat and texts, qualifies, and books.",
  reviews_reputation: "Asks happy customers for reviews, watches new ones, drafts replies.",
  sops: "Writes down how your business runs so anyone can run it.",
};

/** Step 5 — 8 switches, plain language. Toggles are free; status (live / unlocking / roadmap) is shown on the Agent page, not hidden here. */
export default function StepCapabilities({ capabilities, onConfirm }: { capabilities: Cap[]; onConfirm: () => Promise<void> }) {
  const [caps, setCaps] = useState(capabilities); const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const toggle = async (key: string, enabled: boolean) => {
    setBusy(key); setErr(null);
    const r = await fetch("/api/dashboard/capabilities", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ capability: key, enabled }) });
    if (r.ok) setCaps((c) => c.map((x) => (x.key === key ? { ...x, enabled } : x))); else setErr((await r.json()).error || "Could not update.");
    setBusy(null);
  };
  return (
    <div className="border border-neutral-200 rounded-2xl p-6 flex flex-col gap-4">
      <p className="text-[13.5px] text-neutral-600">All eight are included in your plan. Switch off anything you don&apos;t want your agent touching; switch it back on any time from the Agent page. Nothing here costs credits — only work your agent completes does.</p>
      <ul className="divide-y divide-neutral-100">
        {caps.map((c) => (
          <li key={c.key} className="flex items-start justify-between gap-4 py-3">
            <div><div className="text-[14px] font-medium text-neutral-900">{c.name}</div><div className="text-[13px] text-neutral-500 mt-0.5">{PLAIN[c.key] ?? c.short}</div></div>
            <button role="switch" aria-checked={c.enabled} disabled={busy === c.key} onClick={() => toggle(c.key, !c.enabled)} className={`shrink-0 relative w-11 h-6 rounded-full transition-colors ${c.enabled ? "bg-emerald-500" : "bg-neutral-300"}`}><span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${c.enabled ? "left-[22px]" : "left-0.5"}`} /></button>
          </li>
        ))}
      </ul>
      {err && <div className="text-[13px] text-red-600">{err}</div>}
      <div className="pt-1"><button onClick={async () => { setBusy("confirm"); await onConfirm(); setBusy(null); }} disabled={!!busy} className="h-[44px] px-6 rounded-full bg-neutral-900 text-white text-[14px] font-semibold disabled:opacity-60">Continue →</button></div>
    </div>
  );
}
