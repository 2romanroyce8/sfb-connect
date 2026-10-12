"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CampaignStatus } from "@/lib/onboarding/campaignRun";

/** Step 10 — first campaign: launch (enrich + draft) → approval queue → approve per item or all → execute with receipts. */
export default function StepCampaign({ onDone }: { onDone: () => void }) {
  const [s, setS] = useState<CampaignStatus | null>(null); const [busy, setBusy] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null); const [open, setOpen] = useState<string | null>(null);
  const post = useCallback(async (body: Record<string, unknown>) => { const r = await fetch("/api/dashboard/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "Request failed."); return j; }, []);
  const load = useCallback(async () => { try { const j = await post({ action: "campaign_status" }); setS(j.status); } catch (e) { setErr(e instanceof Error ? e.message : "Could not load."); } }, [post]);
  useEffect(() => { void load(); }, [load]);
  const launch = async () => { setBusy("launch"); setErr(null); setMsg(null); try { const j = await post({ action: "campaign_launch" }); const sm = j.summary; setMsg(`${sm.drafted} draft${sm.drafted === 1 ? "" : "s"} ready for your approval${sm.noEmail ? ` · ${sm.noEmail} skipped (no public email found — 0 credits for those)` : ""}${sm.paused ? " · stopped: credits ran out" : ""}${sm.errors ? ` · ${sm.errors} error${sm.errors === 1 ? "" : "s"}` : ""}.`); await load(); } catch (e) { setErr(e instanceof Error ? e.message : "Launch failed."); } finally { setBusy(null); } };
  const approve = async (ids: string[] | "all") => { setBusy(ids === "all" ? "all" : ids[0]); setErr(null); setMsg(null); try { const j = await post({ action: "campaign_approve", data: { ids } }); const r = j.results as { result: string }[]; const n = (k: string) => r.filter((x) => x.result === k).length; setMsg(`${n("sent")} sent · ${n("approved")} approved and queued${j.gmailConnected ? "" : " (connect Gmail to send)"} · ${n("failed")} failed${n("paused") ? " · stopped: credits ran out" : ""}`); await load(); } catch (e) { setErr(e instanceof Error ? e.message : "Approval failed."); } finally { setBusy(null); } };
  const reject = async (id: string) => { setBusy(id); try { await post({ action: "campaign_reject", data: { id } }); await load(); } finally { setBusy(null); } };

  if (!s) return <div className="border border-neutral-200 rounded-2xl p-6 text-[13px] text-neutral-500">{err ?? "Loading…"}</div>;
  const pending = s.queue.filter((q) => q.status === "pending_approval"); const done = s.queue.filter((q) => q.status !== "pending_approval");
  const launched = s.prospects.inSequence > 0 || s.counts.approved + s.counts.sent + s.counts.failed > 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="border border-neutral-200 rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="text-[13.5px] text-neutral-600"><span className="font-semibold text-neutral-900">{s.balance} credits</span> available · reading a prospect&apos;s site costs {s.prices.enrich}, a draft {s.prices.write}, your approval {s.prices.review}. Failed work costs 0. <Link href="/dashboard/credits" className="underline">Top up</Link></div>
        <div className="text-[12.5px] text-neutral-500">{s.prospects.total} on your list · {s.prospects.sourced} not yet contacted · {s.prospects.inSequence} in sequence</div>
      </div>

      {s.plan.topUp && <div className="border border-amber-200 bg-amber-50 rounded-2xl p-5"><div className="text-[14px] font-semibold text-amber-900">{s.balance <= 0 ? "You're out of credits." : `Not enough credits for one more prospect (${s.prices.enrich + s.prices.write} needed, ${s.balance} left).`}</div><div className="text-[13px] text-amber-800 mt-1">Nothing is lost — your list and sequence are saved. Add credits and launch picks up exactly here.</div><Link href="/dashboard/credits" className="inline-flex mt-3 h-[40px] px-5 rounded-full bg-neutral-900 text-white text-[13.5px] font-semibold items-center">Add credits →</Link></div>}

      {!s.plan.topUp && s.plan.count > 0 && (
        <div className="border border-neutral-900 rounded-2xl p-5">
          <div className="text-[15px] font-semibold text-neutral-900">Launch your first campaign</div>
          <p className="text-[13.5px] text-neutral-600 mt-1">Your agent will read the next {s.plan.count} businesses on your list, find a contact, and write each one an intro using your offer line. <strong className="text-neutral-900">Nothing sends.</strong> Every draft lands below for your approval first. Estimated {s.plan.estimatedCredits} credits.</p>
          <button onClick={launch} disabled={!!busy} className="mt-4 h-[44px] px-6 rounded-full bg-neutral-900 text-white text-[14px] font-semibold disabled:opacity-60">{busy === "launch" ? "Working… (this reads real websites, 20–60 s)" : launched ? `Draft ${s.plan.count} more →` : `Launch — draft ${s.plan.count} intros →`}</button>
        </div>
      )}
      {s.plan.reason === "no_prospects" && !launched && <div className="border border-neutral-200 rounded-2xl p-5 text-[13.5px] text-neutral-600">No businesses left to contact. <Link href="/dashboard/onboarding/leads" className="underline">Add more in step 7.</Link></div>}
      {msg && <div className="text-[13px] text-neutral-700">{msg}</div>}{err && <div className="text-[13px] text-red-600">{err}</div>}

      <div className="border border-neutral-200 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div><div className="text-[15px] font-semibold text-neutral-900">Approval queue · {pending.length} waiting</div><div className="text-[12.5px] text-neutral-500 mt-0.5">Read each draft. Approve what you&apos;d send yourself; reject the rest. Approving is a human review pass ({s.prices.review} credits) and {s.gmailConnected ? "sends it from your Gmail." : "queues it — connect Gmail to send."}</div></div>
          {pending.length > 1 && <button onClick={() => approve("all")} disabled={!!busy} className="h-[40px] px-5 rounded-full bg-emerald-600 text-white text-[13.5px] font-semibold disabled:opacity-60">{busy === "all" ? "Approving…" : `Approve all ${pending.length}`}</button>}
        </div>
        {pending.length === 0 ? <div className="text-[13px] text-neutral-500 mt-4">Nothing waiting. {launched ? "Your approved messages are below." : "Launch above to get your first drafts."}</div> : (
          <ul className="mt-4 divide-y divide-neutral-100">
            {pending.map((q) => (
              <li key={q.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><div className="text-[14px] font-medium text-neutral-900">{q.prospect} <span className="text-neutral-400 font-normal">· {q.to}</span></div><div className="text-[13px] text-neutral-700 mt-0.5">{q.subject}</div></div>
                  <div className="shrink-0 flex items-center gap-2"><button onClick={() => setOpen(open === q.id ? null : q.id)} className="h-[32px] px-3 rounded-full border border-neutral-300 text-[12.5px]">{open === q.id ? "Hide" : "Read"}</button><button onClick={() => reject(q.id)} disabled={!!busy} className="h-[32px] px-3 rounded-full border border-neutral-300 text-[12.5px] text-neutral-600">Reject</button><button onClick={() => approve([q.id])} disabled={!!busy} className="h-[32px] px-3.5 rounded-full bg-emerald-600 text-white text-[12.5px] font-semibold">{busy === q.id ? "…" : "Approve"}</button></div>
                </div>
                {open === q.id && <pre className="mt-3 text-[12.5px] text-neutral-700 whitespace-pre-wrap font-sans leading-relaxed bg-neutral-50 rounded-lg p-3">{q.body}</pre>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {done.length > 0 && (
        <div className="border border-neutral-200 rounded-2xl p-5">
          <div className="text-[13px] font-semibold text-neutral-900 mb-2">Decided</div>
          <ul className="divide-y divide-neutral-100">{done.slice(0, 20).map((q) => <li key={q.id} className="py-2 flex items-center justify-between gap-3 text-[13px]"><span className="truncate text-neutral-800">{q.prospect} <span className="text-neutral-400">· {q.subject}</span></span><span className={`shrink-0 text-[11px] rounded-full px-2 py-0.5 ${q.status === "sent" ? "bg-emerald-50 text-emerald-700" : q.status === "approved" ? "bg-blue-50 text-blue-700" : q.status === "failed" ? "bg-red-50 text-red-700" : "bg-neutral-100 text-neutral-600"}`}>{q.status === "approved" ? "approved · queued" : q.status === "failed" ? "approved · send failed" : q.status}{q.status === "failed" ? ` — ${/not connected|Gmail/i.test(q.error ?? "") ? "connect Gmail and it sends" : "we'll retry when your Gmail connection is fixed"}` : ""}</span></li>)}</ul>
        </div>
      )}

      {launched && <div className="flex items-center gap-3 pt-1"><button onClick={onDone} className="h-[44px] px-6 rounded-full bg-neutral-900 text-white text-[14px] font-semibold">See it on your dashboard →</button></div>}
    </div>
  );
}
