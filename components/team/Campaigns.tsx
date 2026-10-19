"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Play, Pause, Flag, Plus, Trash2, Trophy, Save, Tags } from "lucide-react";

// Campaigns (team-only): where Board Room plans run as tests. Performance is read live from
// outbound (sends/opens/replies by template) and the CRM (calls/meetings/deals by lead tag).
const card: React.CSSProperties = { background: "var(--hx-0a0a0a)", border: "1px solid rgb(var(--w) / 0.08)" };
const input: React.CSSProperties = { background: "var(--hx-101010)", border: "1px solid rgb(var(--w) / 0.1)", color: "var(--hx-f5f5f7)" };
const btn = "inline-flex items-center gap-1.5 h-[32px] px-3 rounded-full text-[12.5px] font-semibold disabled:opacity-50";
const primary: React.CSSProperties = { background: "rgb(var(--w))", color: "rgb(var(--k))" };
const ghost: React.CSSProperties = { border: "1px solid rgb(var(--w) / 0.14)", color: "var(--hx-f5f5f7)" };
const ST: Record<string, string> = { draft: "var(--hx-a1a1a6)", running: "var(--hx-30d158)", paused: "var(--hx-ffd60a)", completed: "var(--hx-0a84ff)" };
type M = { sends: number; opens: number; replies: number; calls: number; booked: number; won: number; revenue: number };
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : "—");
const MetricRow = ({ m }: { m: M | null }) => !m ? <span className="text-[12px] text-[color:var(--hx-6e6e73)]">Not started</span> : (
  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[color:var(--hx-a1a1a6)]">
    <span>Sends <b className="text-[color:var(--hx-f5f5f7)]">{m.sends}</b></span><span>Opens <b className="text-[color:var(--hx-f5f5f7)]">{m.opens}</b> ({pct(m.opens, m.sends)})</span><span>Replies <b className="text-[color:var(--hx-f5f5f7)]">{m.replies}</b> ({pct(m.replies, m.sends)})</span><span>Calls <b className="text-[color:var(--hx-f5f5f7)]">{m.calls}</b></span><span>Booked <b className="text-[color:var(--hx-f5f5f7)]">{m.booked}</b></span><span>Closed <b className="text-[color:var(--hx-f5f5f7)]">{m.won}</b>{m.revenue ? ` ($${m.revenue.toLocaleString()})` : ""}</span>
  </div>
);

type Camp = { id: string; idea_id: string | null; idea_title?: string | null; name: string; status: string; hypothesis: string | null; audience: string | null; success_criteria: string | null; target_metric: string | null; messaging: string | null; channels: string[]; audience_tag: string | null; start_date: string | null; end_date: string | null; outcome: string | null; result_notes: string | null; winner_variant_id: string | null; metrics?: M | null; plan_snapshot: Record<string, unknown> | null };
type Variant = { id: string; name: string; template_key: string | null; lead_tag: string | null; subject: string | null; body: string | null; notes: string | null };
type Detail = { campaign: Camp; variants: Variant[]; idea: { id: string; title: string; status: string; result_summary: string | null } | null; metrics: { total: M; perVariant: { id: string; m: M }[] }; winner: { id: string | null; reason: string }; templates: { key: string; name: string }[]; audienceCount: number; channels: string[] };

export default function Campaigns({ initialId }: { initialId: string | null }) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(initialId);
  const [list, setList] = useState<{ setupNeeded?: boolean; message?: string; campaigns?: Camp[] } | null>(null);
  const [d, setD] = useState<Detail | null>(null); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null); const [note, setNote] = useState<string | null>(null);
  const [edit, setEdit] = useState<Partial<Camp>>({}); const [src, setSrc] = useState({ source_tag: "", stage: "" });
  const [done, setDone] = useState<{ outcome: string; notes: string; winner: string } | null>(null);

  const loadList = useCallback(async () => { const r = await fetch("/api/team/campaigns", { cache: "no-store" }); const j = await r.json(); if (!r.ok) setErr(j.error); else setList(j); }, []);
  const loadOne = useCallback(async (cid: string) => { const r = await fetch(`/api/team/campaigns?id=${cid}`, { cache: "no-store" }); const j = await r.json(); if (!r.ok) { setErr(j.error); return; } if (j.setupNeeded) { setList(j); return; } setD(j); setEdit({}); }, []);
  useEffect(() => { if (id) void loadOne(id); else void loadList(); }, [id, loadOne, loadList]);
  const open = (cid: string | null) => { setD(null); setErr(null); setNote(null); setId(cid); router.replace(cid ? `/team/campaigns?id=${cid}` : "/team/campaigns"); };
  const post = async (body: Record<string, unknown>, key: string) => { setBusy(key); setErr(null); try { const r = await fetch("/api/team/campaigns", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "Failed."); if (id) await loadOne(id); else await loadList(); return j; } catch (e) { setErr(e instanceof Error ? e.message : "Failed."); return null; } finally { setBusy(null); } };

  if (!id) return (
    <div className="px-8 py-8 flex flex-col gap-5">
      <div><h1 className="text-[20px] font-semibold text-[color:var(--hx-f5f5f7)]">Campaigns</h1><p className="text-[13px] text-[color:var(--hx-6e6e73)] mt-1">Plans from the <Link href="/team/board-room" className="underline">Board Room</Link> run here as tests. Finish one and its results go back to the idea card.</p></div>
      {err && <div className="rounded-[10px] px-4 py-3 text-[13px] text-[color:var(--hx-ff453a)]" style={{ background: "rgba(255,69,58,0.08)" }}>{err}</div>}
      {!list ? <div className="text-[13px] text-[color:var(--hx-6e6e73)]">Loading…</div> : list.setupNeeded ? <div className="rounded-[12px] p-5 text-[13px] text-[color:var(--hx-a1a1a6)]" style={card}>{list.message}</div> : !list.campaigns?.length ? <div className="rounded-[12px] p-8 text-center text-[13px] text-[color:var(--hx-6e6e73)]" style={card}>No campaigns yet. In the Board Room, build a plan on an idea and press <b>Send to Campaigns</b>.</div> : (
        <div className="flex flex-col gap-2">{list.campaigns.map((c) => (
          <button key={c.id} type="button" onClick={() => open(c.id)} className="rounded-[12px] p-4 text-left flex flex-col gap-2 hover:opacity-90" style={card}>
            <div className="flex items-center justify-between gap-3"><div className="text-[14px] font-semibold text-[color:var(--hx-f5f5f7)]">{c.name}</div><span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: ST[c.status] }}>{c.status}{c.outcome ? ` · ${c.outcome}` : ""}</span></div>
            <div className="text-[11.5px] text-[color:var(--hx-6e6e73)]">{c.idea_title ? `From idea: ${c.idea_title}` : "No linked idea"} · {c.start_date ?? "?"} → {c.end_date ?? "?"}</div>
            <MetricRow m={c.metrics ?? null} />
          </button>
        ))}</div>
      )}
    </div>
  );

  const c = d?.campaign; const locked = c?.status === "completed";
  const val = <K extends keyof Camp>(k: K) => (edit[k] !== undefined ? edit[k] : c?.[k]) as Camp[K];
  return (
    <div className="px-8 py-8 flex flex-col gap-4">
      <button type="button" onClick={() => open(null)} className="self-start inline-flex items-center gap-1 text-[12.5px] text-[color:var(--hx-a1a1a6)] hover:text-white"><ArrowLeft size={13} /> All campaigns</button>
      {err && <div className="rounded-[10px] px-4 py-3 text-[13px] text-[color:var(--hx-ff453a)]" style={{ background: "rgba(255,69,58,0.08)" }}>{err}</div>}
      {note && <div className="rounded-[10px] px-4 py-3 text-[13px] text-[color:var(--hx-30d158)]" style={{ background: "rgba(48,209,88,0.08)" }}>{note}</div>}
      {!d || !c ? <div className="text-[13px] text-[color:var(--hx-6e6e73)]">Loading…</div> : (<>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h1 className="text-[20px] font-semibold text-[color:var(--hx-f5f5f7)]">{c.name}</h1><div className="text-[12px] text-[color:var(--hx-6e6e73)] mt-1"><span style={{ color: ST[c.status] }} className="font-semibold uppercase">{c.status}</span>{d.idea && <> · from <Link href="/team/board-room" className="underline">{d.idea.title}</Link></>} · {c.start_date ?? "?"} → {c.end_date ?? "?"}</div></div>
          <div className="flex gap-2">
            {c.status === "draft" && <button type="button" disabled={!!busy} onClick={() => void post({ action: "set_status", id: c.id, status: "running" }, "st")} className={btn} style={primary}><Play size={13} /> Start</button>}
            {c.status === "running" && <button type="button" disabled={!!busy} onClick={() => void post({ action: "set_status", id: c.id, status: "paused" }, "st")} className={btn} style={ghost}><Pause size={13} /> Pause</button>}
            {c.status === "paused" && <button type="button" disabled={!!busy} onClick={() => void post({ action: "set_status", id: c.id, status: "running" }, "st")} className={btn} style={primary}><Play size={13} /> Resume</button>}
            {(c.status === "running" || c.status === "paused") && <button type="button" onClick={() => setDone({ outcome: "", notes: "", winner: d.winner.id ?? "" })} className={btn} style={ghost}><Flag size={13} /> Complete</button>}
          </div>
        </div>

        <div className="rounded-[12px] p-4" style={card}><div className="text-[12px] font-semibold text-[color:var(--hx-f5f5f7)] mb-2">Live performance</div><MetricRow m={c.status === "draft" ? null : d.metrics.total} /><div className="text-[11px] text-[color:var(--hx-6e6e73)] mt-2">Emails: outbound messages using each variant&apos;s template, sent between the campaign dates. Calls / booked / closed: CRM leads tagged <b>{c.audience_tag ?? "—"}</b> ({d.audienceCount} leads).</div></div>

        <div className="grid lg:grid-cols-2 gap-3">
          <div className="rounded-[12px] p-4 flex flex-col gap-2" style={card}>
            <div className="text-[13px] font-semibold text-[color:var(--hx-f5f5f7)]">Plan &amp; setup</div>
            {([["hypothesis", "What we're testing"], ["audience", "Target audience"], ["success_criteria", "Success looks like"], ["messaging", "Messaging / assets"]] as const).map(([k, l]) => <label key={k} className="flex flex-col gap-1 text-[11.5px] text-[color:var(--hx-6e6e73)]">{l}<textarea disabled={locked} rows={2} value={(val(k) as string) ?? ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} className="rounded-[8px] px-2.5 py-1.5 text-[12.5px]" style={input} /></label>)}
            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1 text-[11.5px] text-[color:var(--hx-6e6e73)]">Start<input disabled={locked} type="date" value={(val("start_date") as string) ?? ""} onChange={(e) => setEdit({ ...edit, start_date: e.target.value })} className="h-[32px] rounded-[8px] px-2 text-[12px]" style={input} /></label>
              <label className="flex flex-col gap-1 text-[11.5px] text-[color:var(--hx-6e6e73)]">End<input disabled={locked} type="date" value={(val("end_date") as string) ?? ""} onChange={(e) => setEdit({ ...edit, end_date: e.target.value })} className="h-[32px] rounded-[8px] px-2 text-[12px]" style={input} /></label>
              <label className="flex flex-col gap-1 text-[11.5px] text-[color:var(--hx-6e6e73)]">Audience tag<input disabled={locked} value={(val("audience_tag") as string) ?? ""} onChange={(e) => setEdit({ ...edit, audience_tag: e.target.value })} className="h-[32px] rounded-[8px] px-2 text-[12px]" style={input} /></label>
            </div>
            <div className="flex flex-wrap gap-2">{d.channels.map((ch) => <label key={ch} className="inline-flex items-center gap-1.5 text-[12px] text-[color:var(--hx-f5f5f7)]"><input disabled={locked} type="checkbox" checked={(val("channels") as string[]).includes(ch)} onChange={(e) => { const cur = val("channels") as string[]; setEdit({ ...edit, channels: e.target.checked ? [...cur, ch] : cur.filter((x) => x !== ch) }); }} />{ch.replace("_", " ")}</label>)}</div>
            {!locked && Object.keys(edit).length > 0 && <button type="button" disabled={busy === "save"} onClick={() => void post({ action: "update", id: c.id, ...edit }, "save")} className={`${btn} self-start`} style={primary}><Save size={13} /> Save</button>}
          </div>
          <div className="rounded-[12px] p-4 flex flex-col gap-2" style={card}>
            <div className="text-[13px] font-semibold text-[color:var(--hx-f5f5f7)]">Audience (CRM leads)</div>
            <div className="text-[12px] text-[color:var(--hx-a1a1a6)]">{d.audienceCount} leads carry <b>{c.audience_tag ?? "—"}</b>. Pull existing leads in by one of their tags — the campaign tag is added, nothing else changes. Reps work them from Leads / Follow-Ups as usual.</div>
            {!locked && <div className="flex gap-2"><input value={src.source_tag} onChange={(e) => setSrc({ ...src, source_tag: e.target.value })} placeholder="source tag, e.g. roofing-pilot" className="flex-1 h-[32px] rounded-[8px] px-2.5 text-[12px]" style={input} /><input value={src.stage} onChange={(e) => setSrc({ ...src, stage: e.target.value })} placeholder="stage (optional)" className="w-[120px] h-[32px] rounded-[8px] px-2.5 text-[12px]" style={input} /><button type="button" disabled={!src.source_tag || !!busy} onClick={async () => { const j = await post({ action: "add_audience", id: c.id, ...src }, "aud"); if (j) setNote(`Added ${j.added} leads to the audience.`); }} className={btn} style={ghost}><Tags size={13} /> Add</button></div>}
            {!locked && d.variants.length >= 2 && <button type="button" disabled={!!busy || !d.audienceCount} onClick={async () => { const j = await post({ action: "split_audience", id: c.id }, "split"); if (j) setNote(`Split ${j.split} leads across ${j.tags.join(" / ")} for the call variants.`); }} className={`${btn} self-start`} style={ghost}>Split audience A/B for calls</button>}
            {c.audience_tag && <Link href={`/team/leads?tag=${encodeURIComponent(c.audience_tag)}`} className="text-[12px] text-[color:var(--hx-0a84ff)]">Open these leads →</Link>}
          </div>
        </div>

        <div className="rounded-[12px] p-4 flex flex-col gap-3" style={card}>
          <div className="flex items-center justify-between"><div className="text-[13px] font-semibold text-[color:var(--hx-f5f5f7)]">A/B variants</div>{!locked && <button type="button" onClick={() => void post({ action: "add_variant", id: c.id, name: `Variant ${String.fromCharCode(65 + d.variants.length)}` }, "addv")} className={btn} style={ghost}><Plus size={13} /> Variant</button>}</div>
          <div className="text-[12px] text-[color:var(--hx-a1a1a6)]">{c.status === "draft" ? "Pick each variant's outbound template (email) and/or its lead tag (call script)." : `Leader: ${d.winner.id ? d.variants.find((v) => v.id === d.winner.id)?.name : "none yet"} — ${d.winner.reason}`}</div>
          <div className="grid lg:grid-cols-2 gap-3">{d.variants.map((v) => { const m = d.metrics.perVariant.find((p) => p.id === v.id)?.m ?? null; const isW = c.winner_variant_id === v.id; return (
            <VariantCard key={v.id} v={v} m={c.status === "draft" ? null : m} winner={isW} locked={locked} templates={d.templates} busy={!!busy}
              onSave={(patch) => void post({ action: "update_variant", variant_id: v.id, ...patch }, `v-${v.id}`)}
              onDelete={() => void post({ action: "delete_variant", variant_id: v.id }, `dv-${v.id}`)}
              onTemplate={async () => { if (await post({ action: "save_winner_template", id: c.id, variant_id: v.id }, `t-${v.id}`)) setNote(`Saved “${v.name}” as an outbound template (Outbound → Compose & templates).`); }} />
          ); })}</div>
        </div>

        {c.status === "completed" && <div className="rounded-[12px] p-4 text-[12.5px] whitespace-pre-wrap" style={{ ...card, borderColor: "rgba(48,209,88,0.35)" }}><b className="text-[color:var(--hx-f5f5f7)]">Result ({c.outcome})</b>{d.idea?.result_summary ? `\n${d.idea.result_summary}` : ""}{d.idea && <div className="mt-2"><Link href="/team/board-room" className="text-[color:var(--hx-0a84ff)]">Decide on the idea card: scale, iterate or kill →</Link></div>}</div>}
      </>)}

      {done && c && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setDone(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={async (e) => { e.preventDefault(); const j = await post({ action: "complete", id: c.id, outcome: done.outcome, notes: done.notes, winner_variant_id: done.winner }, "done"); if (j) { setDone(null); setNote("Completed — results sent back to the Board Room idea."); } }} className="w-full max-w-[480px] rounded-[14px] p-5 flex flex-col gap-3" style={card}>
            <div className="text-[15px] font-semibold text-[color:var(--hx-f5f5f7)]">Complete “{c.name}”</div>
            <div className="text-[12px] text-[color:var(--hx-a1a1a6)]">Goal: {c.success_criteria ?? "—"}</div>
            <div className="flex gap-2">{[["hit", "Hit the goal"], ["missed", "Missed"], ["inconclusive", "Inconclusive"]].map(([k, l]) => <button key={k} type="button" onClick={() => setDone({ ...done, outcome: k })} className={btn} style={done.outcome === k ? primary : ghost}>{l}</button>)}</div>
            <label className="flex flex-col gap-1 text-[12px] text-[color:var(--hx-a1a1a6)]">Winning variant<select value={done.winner} onChange={(e) => setDone({ ...done, winner: e.target.value })} className="h-[34px] rounded-[8px] px-2 text-[12.5px]" style={input}><option value="">No winner</option>{d!.variants.map((v) => <option key={v.id} value={v.id}>{v.name}{d!.winner.id === v.id ? " (leading)" : ""}</option>)}</select></label>
            <textarea rows={3} value={done.notes} onChange={(e) => setDone({ ...done, notes: e.target.value })} placeholder="What did we learn?" className="rounded-[8px] px-3 py-2 text-[13px]" style={input} />
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setDone(null)} className={btn} style={ghost}>Cancel</button><button type="submit" disabled={!done.outcome || busy === "done"} className={btn} style={primary}>Complete &amp; send results</button></div>
          </form>
        </div>
      )}
    </div>
  );
}

function VariantCard({ v, m, winner, locked, templates, busy, onSave, onDelete, onTemplate }: { v: Variant; m: M | null; winner: boolean; locked: boolean; templates: { key: string; name: string }[]; busy: boolean; onSave: (p: Record<string, string>) => void; onDelete: () => void; onTemplate: () => void }) {
  const [p, setP] = useState({ name: v.name, template_key: v.template_key ?? "", lead_tag: v.lead_tag ?? "", subject: v.subject ?? "", body: v.body ?? "", notes: v.notes ?? "" });
  const dirty = p.name !== v.name || p.template_key !== (v.template_key ?? "") || p.lead_tag !== (v.lead_tag ?? "") || p.subject !== (v.subject ?? "") || p.body !== (v.body ?? "") || p.notes !== (v.notes ?? "");
  return (
    <div className="rounded-[10px] p-3 flex flex-col gap-2" style={{ background: "var(--hx-050505)", border: `1px solid ${winner ? "var(--hx-30d158)" : "rgb(var(--w) / 0.08)"}` }}>
      <div className="flex items-center gap-2"><input disabled={locked} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} className="flex-1 h-[30px] rounded-[6px] px-2 text-[13px] font-semibold" style={input} />{winner && <Trophy size={15} className="text-[color:var(--hx-30d158)]" />}{!locked && <button type="button" onClick={onDelete} className="text-[color:var(--hx-6e6e73)] hover:text-white"><Trash2 size={14} /></button>}</div>
      <select disabled={locked} value={p.template_key} onChange={(e) => setP({ ...p, template_key: e.target.value })} className="h-[30px] rounded-[6px] px-2 text-[12px]" style={input}><option value="">Email template: none</option>{templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}</select>
      <input disabled={locked} value={p.lead_tag} onChange={(e) => setP({ ...p, lead_tag: e.target.value })} placeholder="Lead tag for this variant's calls (optional)" className="h-[30px] rounded-[6px] px-2 text-[12px]" style={input} />
      <input disabled={locked} value={p.subject} onChange={(e) => setP({ ...p, subject: e.target.value })} placeholder="Subject / call opener" className="h-[30px] rounded-[6px] px-2 text-[12px]" style={input} />
      <textarea disabled={locked} rows={3} value={p.body} onChange={(e) => setP({ ...p, body: e.target.value })} placeholder="Copy or call script" className="rounded-[6px] px-2 py-1.5 text-[12px]" style={input} />
      {m && <MetricRow m={m} />}
      <div className="flex gap-2">{!locked && dirty && <button type="button" disabled={busy} onClick={() => onSave(p)} className={btn} style={primary}><Save size={13} /> Save</button>}{locked && winner && <button type="button" disabled={busy} onClick={onTemplate} className={btn} style={ghost}>Save as template</button>}</div>
    </div>
  );
}
