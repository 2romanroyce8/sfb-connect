"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, ThumbsUp, Skull, Send, Lightbulb, Users, Archive, ClipboardList, RotateCcw } from "lucide-react";
import { useMultiSelect, SelectCircle, SelectToggle, BulkBar, postJson } from "@/components/ui/MultiSelect";
import { plural } from "@/lib/ui/selection";


// The Board Room (team-only): plan and brainstorm before anything goes live.
// Idea → plan → Send to Campaigns → results come back here → scale / iterate / kill.
const card: React.CSSProperties = { background: "var(--hx-0a0a0a)", border: "1px solid rgb(var(--w) / 0.08)" };
const input: React.CSSProperties = { background: "var(--hx-101010)", border: "1px solid rgb(var(--w) / 0.1)", color: "var(--hx-f5f5f7)" };
const btn = "inline-flex items-center gap-1.5 h-[32px] px-3 rounded-full text-[12.5px] font-semibold disabled:opacity-50";
const primary: React.CSSProperties = { background: "rgb(var(--w))", color: "rgb(var(--k))" };
const ghost: React.CSSProperties = { border: "1px solid rgb(var(--w) / 0.14)", color: "var(--hx-f5f5f7)" };
const STATUS: Record<string, { label: string; color: string }> = { draft: { label: "Draft", color: "var(--hx-a1a1a6)" }, ready: { label: "Ready to test", color: "var(--hx-0a84ff)" }, tested: { label: "Tested", color: "var(--hx-30d158)" }, killed: { label: "Killed", color: "var(--hx-ff453a)" } };
const CH = [["email", "Email"], ["calls", "Calls"], ["sms", "SMS"], ["social", "Social"], ["in_person", "In person"]];
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }) : "");

type Plan = { what: string; who: string; success: string; duration_days: number; channels: string[]; audience_tag: string | null };
type Idea = { id: string; title: string; description: string | null; target_metric: string | null; status: string; plan: Plan | null; kill_reason: string | null; killed_at: string | null; decision: string | null; result_summary: string | null; last_campaign_id: string | null; session_id: string | null; parent_idea_id: string | null; votes: number; voted: boolean; author: string; created_at: string };
type Session = { id: string; topic: string; status: string; created_at: string };

export default function BoardRoom() {
  const [d, setD] = useState<{ setupNeeded?: boolean; message?: string; ideas: Idea[]; sessions: Session[] } | null>(null);
  const [tab, setTab] = useState<"ideas" | "sessions" | "archive">("ideas");
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null); const [note, setNote] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", target_metric: "" }); const [adding, setAdding] = useState(false);
  const [planFor, setPlanFor] = useState<Idea | null>(null); const [plan, setPlan] = useState<Plan>({ what: "", who: "", success: "", duration_days: 7, channels: ["email"], audience_tag: null });
  const [killFor, setKillFor] = useState<Idea | null>(null); const [reason, setReason] = useState("");
  const [openSession, setOpenSession] = useState<string | null>(null); const [topic, setTopic] = useState(""); const [quick, setQuick] = useState("");

  const load = useCallback(async () => { try { const r = await fetch("/api/team/board-room", { cache: "no-store" }); const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j); } catch (e) { setErr(e instanceof Error ? e.message : "Could not load."); } }, []);
  useEffect(() => { void load(); }, [load]);
  // Brainstorms are live: poll every 5 s while a session is open on screen.
  useEffect(() => { if (!openSession) return; const t = window.setInterval(() => void load(), 5000); return () => window.clearInterval(t); }, [openSession, load]);
  const post = async (body: Record<string, unknown>, key: string) => { setBusy(key); setErr(null); try { const r = await fetch("/api/team/board-room", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "Failed."); await load(); return j; } catch (e) { setErr(e instanceof Error ? e.message : "Failed."); return null; } finally { setBusy(null); } };

  const active = useMemo(() => (d?.ideas ?? []).filter((i) => i.status !== "killed"), [d]);
  const killed = useMemo(() => (d?.ideas ?? []).filter((i) => i.status === "killed"), [d]);
  const visibleIdeas = tab === "ideas" ? [...active].sort((a, b) => b.votes - a.votes) : tab === "archive" ? killed : [];
  const ms = useMultiSelect(visibleIdeas.map((i) => i.id));
  const ideasN = (n: number) => plural(n, "idea");
  const bulkActions = [
    ...(tab === "ideas" ? [{ label: "Change status", options: [{ label: "Draft", value: "draft" }, { label: "Ready to test", value: "ready" }, { label: "Tested", value: "tested" }], confirm: (n: number) => `Change status of ${ideasN(n)}?`, run: async (ids: string[], v?: string) => { const j = await postJson("/api/team/board-room", { action: "bulk_status", ids, status: v }); await load(); return `${ideasN(j.count)} set to ${STATUS[v ?? ""]?.label ?? v}`; } }] : []),
    { label: "Delete", tone: "danger" as const, confirm: (n: number) => `Delete ${ideasN(n)}?`, run: async (ids: string[]) => { const j = await postJson("/api/team/board-room", { action: "bulk_delete", ids }); await load(); return `${ideasN(j.count)} deleted`; } },
  ];
  const sessionIdeas = (sid: string) => (d?.ideas ?? []).filter((i) => i.session_id === sid).sort((a, b) => b.votes - a.votes);

  const openPlan = (i: Idea) => { setPlanFor(i); setPlan(i.plan ?? { what: i.description ?? "", who: "", success: i.target_metric ?? "", duration_days: 7, channels: ["email"], audience_tag: null }); };

  const IdeaCard = ({ i }: { i: Idea }) => (
    <article className="rounded-[12px] p-4 flex flex-col gap-2.5" style={{ ...card, ...(ms.isSelected(i.id) ? { borderColor: "var(--hx-0a84ff)" } : {}) }}>
      <div className="flex items-start justify-between gap-3">
        {ms.active && <SelectCircle checked={ms.isSelected(i.id)} onToggle={() => ms.toggle(i.id)} label={`Select ${i.title}`} />}
        <div className="min-w-0 flex-1"><div className="text-[14px] font-semibold text-[color:var(--hx-f5f5f7)]">{i.title}</div><div className="text-[11.5px] text-[color:var(--hx-6e6e73)]">{i.author} · {fmt(i.created_at)}{i.target_metric ? ` · target: ${i.target_metric}` : ""}</div></div>
        <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full" style={{ color: STATUS[i.status]?.color, border: `1px solid color-mix(in srgb, ${STATUS[i.status]?.color} 40%, transparent)` }}>{STATUS[i.status]?.label ?? i.status}</span>
      </div>
      {i.description && <div className="text-[12.5px] text-[color:var(--hx-a1a1a6)] whitespace-pre-wrap">{i.description}</div>}
      {i.plan && <div className="text-[12px] rounded-[8px] p-2.5 text-[color:var(--hx-a1a1a6)]" style={{ background: "var(--hx-050505)" }}><b className="text-[color:var(--hx-f5f5f7)]">Plan:</b> {i.plan.what} · for {i.plan.who} · success = {i.plan.success} · {i.plan.duration_days} days · {i.plan.channels.join(", ")}</div>}
      {i.result_summary && <div className="text-[12px] rounded-[8px] p-2.5 whitespace-pre-wrap" style={{ background: "rgba(48,209,88,0.08)", color: "var(--hx-f5f5f7)" }}><b>Results:</b> {i.result_summary}{i.decision && <div className="mt-1 font-semibold">Decision: {i.decision}</div>}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void post({ action: i.voted ? "unvote" : "vote", id: i.id }, `v-${i.id}`)} className={btn} style={i.voted ? { ...ghost, color: "var(--hx-0a84ff)", borderColor: "var(--hx-0a84ff)" } : ghost}><ThumbsUp size={13} /> {i.votes}</button>
        {i.status !== "tested" && <button type="button" onClick={() => openPlan(i)} className={btn} style={ghost}><ClipboardList size={13} /> {i.plan ? "Edit plan" : "Build plan"}</button>}
        {i.status === "ready" && !i.last_campaign_id && <button type="button" disabled={busy === `s-${i.id}`} onClick={async () => { const j = await post({ action: "send_to_campaigns", id: i.id }, `s-${i.id}`); if (j?.campaignId) setNote(`Campaign draft created from “${i.title}”.`); }} className={btn} style={primary}><Send size={13} /> Send to Campaigns</button>}
        {i.last_campaign_id && <Link href={`/team/campaigns?id=${i.last_campaign_id}`} className={btn} style={ghost}>Open campaign →</Link>}
        {i.status === "tested" && !i.decision && <>
          <button type="button" onClick={() => void post({ action: "decide", id: i.id, decision: "scale" }, `d-${i.id}`)} className={btn} style={{ ...ghost, color: "var(--hx-30d158)" }}>Scale it</button>
          <button type="button" onClick={() => void post({ action: "decide", id: i.id, decision: "iterate" }, `d-${i.id}`)} className={btn} style={ghost}><RotateCcw size={13} /> Iterate (v2)</button>
        </>}
        <button type="button" onClick={() => { setKillFor(i); setReason(""); }} className={btn} style={{ ...ghost, color: "var(--hx-ff453a)" }}><Skull size={13} /> Kill</button>
      </div>
    </article>
  );

  return (
    <div className="px-8 py-8 flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-[20px] font-semibold text-[color:var(--hx-f5f5f7)]">The Board Room</h1><p className="text-[13px] text-[color:var(--hx-6e6e73)] mt-1">Brainstorm, pick the best ideas, plan the test, then send it to <Link href="/team/campaigns" className="underline">Campaigns</Link>. Results come back to the idea card.</p></div>
        <div className="flex items-center gap-2">{tab !== "sessions" && <SelectToggle ms={ms} total={visibleIdeas.length} noun="ideas" />}<button type="button" onClick={() => setAdding((a) => !a)} className={btn} style={primary}><Plus size={14} /> New idea</button></div>
      </div>
      <div className="inline-flex gap-1 p-1 rounded-full self-start" style={{ background: "rgb(var(--w) / 0.06)", border: "1px solid rgb(var(--w) / 0.1)" }}>
        {([["ideas", `Ideas (${active.length})`, Lightbulb], ["sessions", "Brainstorms", Users], ["archive", `Killed (${killed.length})`, Archive]] as const).map(([k, l, I]) => <button key={k} type="button" onClick={() => { setTab(k); ms.cancel(); }} className="inline-flex items-center gap-1.5 h-[32px] px-3.5 rounded-full text-[12.5px] font-semibold" style={{ background: tab === k ? "rgb(var(--w))" : "transparent", color: tab === k ? "rgb(var(--k))" : "var(--hx-a1a1a6)" }}><I size={13} />{l}</button>)}
      </div>
      {err && <div className="rounded-[10px] px-4 py-3 text-[13px] text-[color:var(--hx-ff453a)]" style={{ background: "rgba(255,69,58,0.08)" }}>{err}</div>}
      {note && <div className="rounded-[10px] px-4 py-3 text-[13px] text-[color:var(--hx-30d158)]" style={{ background: "rgba(48,209,88,0.08)" }}>{note} <Link href="/team/campaigns" className="underline">Go to Campaigns</Link></div>}

      {adding && (
        <form onSubmit={async (e) => { e.preventDefault(); if (await post({ action: "create_idea", ...form }, "new")) { setForm({ title: "", description: "", target_metric: "" }); setAdding(false); } }} className="rounded-[12px] p-4 grid gap-2" style={card}>
          <input required minLength={3} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Idea — e.g. Lead with missed-call revenue for FL roofers" className="h-[38px] rounded-[8px] px-3 text-[13px]" style={input} />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="What's the idea and why might it work?" className="rounded-[8px] px-3 py-2 text-[13px]" style={input} />
          <div className="flex gap-2"><input value={form.target_metric} onChange={(e) => setForm({ ...form, target_metric: e.target.value })} placeholder="Target metric — e.g. book 10 calls" className="flex-1 h-[36px] rounded-[8px] px-3 text-[13px]" style={input} /><button type="submit" disabled={busy === "new"} className={btn} style={primary}>Add idea</button></div>
        </form>
      )}

      {!d ? <div className="text-[13px] text-[color:var(--hx-6e6e73)]">Loading…</div> : d.setupNeeded ? <div className="rounded-[12px] p-5 text-[13px] text-[color:var(--hx-a1a1a6)]" style={card}>{d.message}</div> : (
        <>
          {tab === "ideas" && (active.length === 0 ? <div className="rounded-[12px] p-8 text-center text-[13px] text-[color:var(--hx-6e6e73)]" style={card}>No ideas yet. Add one, or start a brainstorm.</div> : <div className="grid lg:grid-cols-2 gap-3">{visibleIdeas.map((i) => <IdeaCard key={i.id} i={i} />)}</div>)}

          {tab === "sessions" && (
            <div className="flex flex-col gap-3">
              <form onSubmit={async (e) => { e.preventDefault(); const j = await post({ action: "start_session", topic }, "sess"); if (j?.id) { setTopic(""); setOpenSession(j.id); } }} className="flex gap-2"><input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic — e.g. Q4 roofing blitz angles" className="flex-1 h-[36px] rounded-[8px] px-3 text-[13px]" style={input} /><button type="submit" disabled={busy === "sess" || topic.trim().length < 3} className={btn} style={primary}><Plus size={13} /> Start brainstorm</button></form>
              {(d.sessions ?? []).map((s) => (
                <div key={s.id} className="rounded-[12px] p-4" style={card}>
                  <div className="flex items-center justify-between gap-3">
                    <button type="button" onClick={() => setOpenSession(openSession === s.id ? null : s.id)} className="text-left"><div className="text-[14px] font-semibold text-[color:var(--hx-f5f5f7)]">{s.topic}</div><div className="text-[11.5px] text-[color:var(--hx-6e6e73)]">{s.status === "open" ? "Open · live" : "Closed"} · {sessionIdeas(s.id).length} ideas · {fmt(s.created_at)}</div></button>
                    {s.status === "open" && <button type="button" onClick={() => void post({ action: "close_session", id: s.id }, `c-${s.id}`)} className={btn} style={ghost}>Close</button>}
                  </div>
                  {openSession === s.id && (
                    <div className="mt-3 flex flex-col gap-2">
                      {s.status === "open" && <form onSubmit={async (e) => { e.preventDefault(); if (await post({ action: "create_idea", title: quick, session_id: s.id }, "q")) setQuick(""); }} className="flex gap-2"><input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Throw an idea in…" className="flex-1 h-[34px] rounded-[8px] px-3 text-[13px]" style={input} /><button type="submit" disabled={busy === "q" || quick.trim().length < 3} className={btn} style={primary}>Add</button></form>}
                      {sessionIdeas(s.id).map((i) => (
                        <div key={i.id} className="flex items-center justify-between gap-2 py-1.5" style={{ borderTop: "1px solid rgb(var(--w) / 0.06)" }}>
                          <div className="text-[13px] text-[color:var(--hx-f5f5f7)]">{i.title} <span className="text-[11px] text-[color:var(--hx-6e6e73)]">· {i.author}{i.status !== "draft" ? ` · ${STATUS[i.status]?.label}` : ""}</span></div>
                          <div className="flex gap-1.5"><button type="button" onClick={() => void post({ action: i.voted ? "unvote" : "vote", id: i.id }, `v-${i.id}`)} className={btn} style={i.voted ? { ...ghost, color: "var(--hx-0a84ff)", borderColor: "var(--hx-0a84ff)" } : ghost}><ThumbsUp size={13} /> {i.votes}</button><button type="button" onClick={() => openPlan(i)} className={btn} style={ghost}>Plan it</button></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === "archive" && (killed.length === 0 ? <div className="rounded-[12px] p-8 text-center text-[13px] text-[color:var(--hx-6e6e73)]" style={card}>Nothing killed yet.</div> : (
            <div className="flex flex-col gap-2">{killed.map((i) => (
              <div key={i.id} className="rounded-[12px] p-4" style={{ ...card, ...(ms.isSelected(i.id) ? { borderColor: "var(--hx-0a84ff)" } : {}) }}>
                <div className="flex items-center justify-between gap-3">{ms.active && <SelectCircle checked={ms.isSelected(i.id)} onToggle={() => ms.toggle(i.id)} label={`Select ${i.title}`} />}<div className="flex-1 text-[14px] font-semibold text-[color:var(--hx-f5f5f7)] line-through decoration-[color:var(--hx-ff453a)]">{i.title}</div><button type="button" onClick={() => void post({ action: "revive_idea", id: i.id }, `r-${i.id}`)} className={btn} style={ghost}>Revive</button></div>
                <div className="text-[12.5px] mt-1" style={{ color: "var(--hx-ff6961)" }}>Killed {fmt(i.killed_at)}: {i.kill_reason}</div>
                {i.result_summary && <div className="text-[12px] mt-2 whitespace-pre-wrap text-[color:var(--hx-a1a1a6)]">{i.result_summary}</div>}
              </div>
            ))}</div>
          ))}
        </>
      )}

      {planFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setPlanFor(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={async (e) => { e.preventDefault(); const j = await post({ action: "save_plan", id: planFor.id, plan }, "plan"); if (j) { if (j.problems?.length) setErr(`Plan saved as draft — still missing: ${j.problems.join(", ")}.`); else { setNote(`Plan saved — “${planFor.title}” is ready to test.`); setPlanFor(null); } } }} className="w-full max-w-[560px] rounded-[14px] p-5 flex flex-col gap-3" style={{ ...card, background: "var(--hx-0a0a0a)" }}>
            <div className="text-[15px] font-semibold text-[color:var(--hx-f5f5f7)]">Test plan · {planFor.title}</div>
            {([["what", "What are we testing?", "e.g. Missed-call revenue hook vs review-requests hook"], ["who", "Who is it for?", "e.g. FL roofing companies, 5–50 staff"], ["success", "What does success look like?", "e.g. 10 calls booked or 5% reply rate"]] as const).map(([k, l, ph]) => <label key={k} className="flex flex-col gap-1 text-[12px] text-[color:var(--hx-a1a1a6)]">{l}<textarea required rows={2} value={plan[k]} onChange={(e) => setPlan({ ...plan, [k]: e.target.value })} placeholder={ph} className="rounded-[8px] px-3 py-2 text-[13px]" style={input} /></label>)}
            <div className="flex gap-3">
              <label className="flex flex-col gap-1 text-[12px] text-[color:var(--hx-a1a1a6)] w-[120px]">Run for (days)<input type="number" min={1} max={90} value={plan.duration_days} onChange={(e) => setPlan({ ...plan, duration_days: Number(e.target.value) })} className="h-[36px] rounded-[8px] px-3 text-[13px]" style={input} /></label>
              <label className="flex flex-col gap-1 text-[12px] text-[color:var(--hx-a1a1a6)] flex-1">CRM lead tag for the audience (optional)<input value={plan.audience_tag ?? ""} onChange={(e) => setPlan({ ...plan, audience_tag: e.target.value })} placeholder="auto: campaign-<idea-name>" className="h-[36px] rounded-[8px] px-3 text-[13px]" style={input} /></label>
            </div>
            <div className="flex flex-wrap gap-2">{CH.map(([k, l]) => <label key={k} className="inline-flex items-center gap-1.5 text-[12.5px] text-[color:var(--hx-f5f5f7)]"><input type="checkbox" checked={plan.channels.includes(k)} onChange={(e) => setPlan({ ...plan, channels: e.target.checked ? [...plan.channels, k] : plan.channels.filter((c) => c !== k) })} />{l}</label>)}</div>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setPlanFor(null)} className={btn} style={ghost}>Cancel</button><button type="submit" disabled={busy === "plan"} className={btn} style={primary}>Save plan</button></div>
          </form>
        </div>
      )}
      {killFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setKillFor(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={async (e) => { e.preventDefault(); if (await post({ action: "kill_idea", id: killFor.id, reason, from_results: killFor.status === "tested" }, "kill")) setKillFor(null); }} className="w-full max-w-[460px] rounded-[14px] p-5 flex flex-col gap-3" style={card}>
            <div className="text-[15px] font-semibold text-[color:var(--hx-f5f5f7)]">Kill “{killFor.title}”</div>
            <textarea required minLength={3} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why? (stays on the card so nobody repeats it)" className="rounded-[8px] px-3 py-2 text-[13px]" style={input} />
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setKillFor(null)} className={btn} style={ghost}>Cancel</button><button type="submit" disabled={busy === "kill"} className={btn} style={{ background: "var(--hx-ff453a)", color: "#fff" }}>Kill idea</button></div>
          </form>
        </div>
      )}
      {tab !== "sessions" && <BulkBar ms={ms} noun={ideasN} actions={bulkActions} />}
      {ms.active && <div className="h-[96px]" />}
    </div>
  );
}
