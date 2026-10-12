"use client";

import { useState } from "react";
import type { LeadCandidate } from "@/lib/onboarding/leads";

type StepData = { candidates?: LeadCandidate[]; queries?: string[]; sourcedAt?: string; acceptedAt?: string; accepted?: number } | null;

/** Step 7 — the agent finds candidates from the ICP; the customer removes what doesn't fit and keeps the rest. Nothing is contacted here. */
export default function StepLeads({ stepData, prospectCount, onDone }: { stepData: Record<string, unknown> | null; prospectCount: number; onDone: () => void }) {
  const d = (stepData as StepData) ?? null;
  const [cands, setCands] = useState<LeadCandidate[]>(d?.candidates ?? []); const [queries, setQueries] = useState<string[]>(d?.queries ?? []);
  const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null); const [result, setResult] = useState<string | null>(null);
  const post = async (action: string, data?: Record<string, unknown>) => { const r = await fetch("/api/dashboard/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, data }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "Request failed."); return j; };
  const source = async () => { setBusy("source"); setErr(null); setResult(null); try { const j = await post("leads_source"); setCands(j.candidates); setQueries(j.queries); if (!j.candidates.length) setResult("Nothing found for that profile yet — widen the industries or add another city in step 6."); } catch (e) { setErr(e instanceof Error ? e.message : "Search failed."); } finally { setBusy(null); } };
  const remove = async (id: string) => { setCands((c) => c.filter((x) => x.id !== id)); try { await post("leads_remove", { id }); } catch { /* list state is what matters; server catches up on the next action */ } };
  const accept = async () => { setBusy("accept"); setErr(null); try { const j = await post("leads_accept", { ids: cands.map((c) => c.id) }); const added = (j.results as { status: string }[]).filter((r) => r.status === "added").length; setResult(`${added} added to your list.`); onDone(); } catch (e) { setErr(e instanceof Error ? e.message : "Could not save."); } finally { setBusy(null); } };

  return (
    <div className="border border-neutral-200 rounded-2xl p-6 flex flex-col gap-4">
      <p className="text-[13.5px] text-neutral-600">Your agent searches the web for businesses matching your ideal customer and lists what it finds. Remove anything that doesn&apos;t fit, keep the rest. <strong className="text-neutral-800">Nobody is contacted at this step</strong> — reaching out happens later, one approved message at a time.</p>
      {prospectCount > 0 && <div className="text-[12.5px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{prospectCount} business{prospectCount === 1 ? "" : "es"} already on your list.</div>}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={source} disabled={!!busy} className="h-[40px] px-5 rounded-full border border-neutral-300 text-[13.5px] font-medium disabled:opacity-50">{busy === "source" ? "Searching…" : cands.length ? "Search again" : "Find matching businesses"}</button>
        {queries.length > 0 && <span className="text-[12px] text-neutral-400">Searched: {queries.join(" · ")}</span>}
      </div>
      {cands.length > 0 && (
        <ul className="divide-y divide-neutral-100 border border-neutral-100 rounded-xl">
          {cands.map((c) => (
            <li key={c.id} className="p-3.5 flex items-start justify-between gap-4">
              <div className="min-w-0"><div className="text-[14px] font-medium text-neutral-900 truncate">{c.name}</div><a href={c.website} target="_blank" rel="noopener noreferrer" className="text-[12px] text-neutral-500 underline underline-offset-2">{c.domain}</a>{c.snippet && <div className="text-[12.5px] text-neutral-500 mt-1 line-clamp-2">{c.snippet}</div>}</div>
              <button onClick={() => remove(c.id)} className="shrink-0 text-[12.5px] text-neutral-500 hover:text-red-600">Remove</button>
            </li>
          ))}
        </ul>
      )}
      {err && <div className="text-[13px] text-red-600">{err}</div>}{result && <div className="text-[13px] text-neutral-600">{result}</div>}
      <div className="flex items-center gap-3 pt-1">
        {cands.length > 0 && <button onClick={accept} disabled={!!busy} className="h-[44px] px-6 rounded-full bg-neutral-900 text-white text-[14px] font-semibold disabled:opacity-60">{busy === "accept" ? "Saving…" : `Keep these ${cands.length} →`}</button>}
        {prospectCount > 0 && cands.length === 0 && <button onClick={onDone} className="h-[44px] px-6 rounded-full bg-neutral-900 text-white text-[14px] font-semibold">Continue →</button>}
      </div>
    </div>
  );
}
