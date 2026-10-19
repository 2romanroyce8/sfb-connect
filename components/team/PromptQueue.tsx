"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Check, Download, Paperclip, Plus, ChevronDown, ChevronUp, Undo2, ArrowLeft, ArrowRight, BellRing, Clock, RefreshCw } from "lucide-react";
import { formatAge, queuedFor, waitedBeforeSend, POLL_MS } from "@/lib/crm/promptTiming";
import type { PromptCard, Urgency } from "@/lib/crm/promptQueue";
import { useMultiSelect, SelectCircle, SelectToggle, BulkBar, postJson } from "@/components/ui/MultiSelect";
import { plural } from "@/lib/ui/selection";


// "Give HyperAgent" (Roman, 2026-10-18): the holding queue for everything Rome pastes into HyperAgent.
// Cards left → right by send order (the only sort). Urgency is a label. Copy = raw text. Done = one click,
// 10-second undo, then it is history in the Sent Prompts folder (append-only).
const URG: Record<Urgency, { label: string; color: string }> = { high: { label: "High", color: "var(--hx-ff453a)" }, medium: { label: "Medium", color: "var(--hx-ffd60a)" }, low: { label: "Low", color: "var(--hx-30d158)" } };
const card: React.CSSProperties = { background: "var(--hx-0a0a0a)", border: "1px solid rgb(var(--w) / 0.08)" };
const input: React.CSSProperties = { background: "var(--hx-101010)", border: "1px solid rgb(var(--w) / 0.1)", color: "var(--hx-f5f5f7)" };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " ET" : "");
const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function UrgencyBadge({ u }: { u: Urgency }) { const c = URG[u]; return <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: c.color, background: `color-mix(in srgb, ${c.color} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${c.color} 40%, transparent)` }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />{c.label}</span>; }

function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(text); } catch { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); } setOk(true); setTimeout(() => setOk(false), 1600); };
  return <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 h-[34px] px-3.5 rounded-full text-[12.5px] font-semibold" style={{ background: ok ? "var(--hx-30d158)" : "rgb(var(--w))", color: "rgb(var(--k))" }}>{ok ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy prompt</>}</button>;
}

/** Re-renders every second so queue ages tick live. */
function useNow(ms = 1000) { const [now, setNow] = useState(() => Date.now()); useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), ms); return () => window.clearInterval(t); }, [ms]); return now; }

function QueueAge({ createdAt }: { createdAt: string }) {
  const now = useNow(1000);
  return <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[color:var(--hx-ffd60a)]" data-queue-age><Clock size={11} /> in queue for {formatAge(queuedFor(createdAt, now))}</span>;
}

export default function PromptQueue() {
  const [queue, setQueue] = useState<PromptCard[]>([]); const [sent, setSent] = useState<PromptCard[]>([]);
  const [view, setView] = useState<"queue" | "sent">("queue"); const [err, setErr] = useState<string | null>(null); const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false); const [form, setForm] = useState({ name: "", prompt_text: "", urgency: "medium" as Urgency, send_order: "" }); const [files, setFiles] = useState<File[]>([]); const [saving, setSaving] = useState(false);
  const [undo, setUndo] = useState<{ card: PromptCard; until: number } | null>(null); const undoTimer = useRef<number | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const ms = useMultiSelect(queue.map((c) => c.id));
  const prompts = (n: number) => plural(n, "prompt");
  const bulkActions = [
    { label: "Mark done", tone: "primary" as const, confirm: (n: number) => `Mark ${prompts(n)} done?`, run: async (ids: string[]) => { const j = await postJson("/api/team/prompts", { action: "bulk_done", ids }); setQueue(j.queue); setSent(j.sent); return `${prompts(j.count)} moved to Sent Prompts`; } },
    { label: "Delete", tone: "danger" as const, confirm: (n: number) => `Delete ${prompts(n)}?`, run: async (ids: string[]) => { const j = await postJson("/api/team/prompts", { action: "bulk_delete", ids }); setQueue(j.queue); return `${prompts(j.count)} deleted`; } },
  ];
  const [notify, setNotify] = useState<{ state: "idle" | "busy" | "done"; at?: string; reused?: boolean }>({ state: "idle" });
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState<"idle" | "busy" | "done">("idle");
  const refreshNow = async () => { setRefreshing("busy"); setErr(null); await load(); setRefreshing("done"); window.setTimeout(() => setRefreshing("idle"), 1500); };

  const load = useCallback(async () => { try { const r = await fetch("/api/team/prompts", { cache: "no-store" }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "Could not load."); setQueue(j.queue); setSent(j.sent); setLoaded(true); setLastSync(Date.now()); } catch (e) { setErr(e instanceof Error ? e.message : "Could not load."); } }, []);
  useEffect(() => { void load(); }, [load]);
  // Auto-refresh: poll every 60 s (and when the tab comes back into view) so new agent cards and status changes appear without a reload.
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") void load(); };
    const t = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(t); document.removeEventListener("visibilitychange", tick); };
  }, [load]);
  const notifyMuse = async () => {
    if (queue.length > 0 && !window.confirm(`${queue.length} card${queue.length === 1 ? " is" : "s are"} still in the queue. Tell Muse everything is sent anyway?`)) return;
    setErr(null); setNotify({ state: "busy" });
    try { const j = await post({ action: "notify_muse" }); setNotify({ state: "done", at: j.notifiedAt, reused: j.reused }); window.setTimeout(() => setNotify((n) => (n.state === "done" ? { state: "idle" } : n)), 8000); }
    catch (e) { setNotify({ state: "idle" }); setErr(e instanceof Error ? e.message : "Could not notify Muse."); }
  };
  const post = async (body: Record<string, unknown>) => { const r = await fetch("/api/team/prompts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "Request failed."); return j; };

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setErr(null);
    try { const fd = new FormData(); fd.set("name", form.name); fd.set("prompt_text", form.prompt_text); fd.set("urgency", form.urgency); if (form.send_order) fd.set("send_order", form.send_order); for (const f of files) fd.append("files", f); const r = await fetch("/api/team/prompts", { method: "POST", body: fd }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "Could not create the card."); setForm({ name: "", prompt_text: "", urgency: "medium", send_order: "" }); setFiles([]); setAdding(false); await load(); }
    catch (e2) { setErr(e2 instanceof Error ? e2.message : "Could not create the card."); } finally { setSaving(false); }
  };
  const move = async (id: string, to: number) => { setErr(null); try { const j = await post({ action: "reorder", id, to }); setQueue(j.queue); } catch (e) { setErr(e instanceof Error ? e.message : "Reorder failed."); } };
  const done = async (c: PromptCard) => {
    setErr(null); setQueue((q) => q.filter((x) => x.id !== c.id)); // optimistic — one click, no confirmation
    try { const j = await post({ action: "done", id: c.id }); setQueue(j.queue); setSent((s) => [j.card, ...s]); setUndo({ card: j.card, until: Date.now() + 10_000 }); if (undoTimer.current) window.clearTimeout(undoTimer.current); undoTimer.current = window.setTimeout(() => setUndo(null), 10_000); }
    catch (e) { setErr(e instanceof Error ? e.message : "Could not mark done."); await load(); }
  };
  const undoNow = async () => { if (!undo) return; const id = undo.card.id; setUndo(null); if (undoTimer.current) window.clearTimeout(undoTimer.current); try { const j = await post({ action: "undo", id }); setQueue(j.queue); setSent((s) => s.filter((x) => x.id !== id)); } catch (e) { setErr(e instanceof Error ? e.message : "Undo failed."); await load(); } };

  return (
    <div className="px-8 py-8 flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-[20px] font-semibold text-[color:var(--hx-f5f5f7)]">Give HyperAgent</h1><p className="text-[13px] text-[color:var(--hx-6e6e73)] mt-1">Everything Rome needs to paste into HyperAgent, in send order. Copy grabs the exact text. Done moves a card to Sent Prompts (10-second undo).</p></div>
        <div className="flex items-center gap-2">
          <div className="inline-flex p-1 rounded-full" style={{ background: "rgb(var(--w) / 0.06)", border: "1px solid rgb(var(--w) / 0.1)" }}>{(["queue", "sent"] as const).map((v) => <button key={v} type="button" onClick={() => { setView(v); ms.cancel(); }} className="h-[32px] px-3.5 rounded-full text-[12.5px] font-semibold" style={{ background: view === v ? "rgb(var(--w))" : "transparent", color: view === v ? "rgb(var(--k))" : "var(--hx-a1a1a6)" }}>{v === "queue" ? `Queue (${queue.length})` : `Sent Prompts (${sent.length})`}</button>)}</div>
          <button type="button" onClick={() => void refreshNow()} disabled={refreshing === "busy"} title="Reload the queue and Sent Prompts now" className="inline-flex items-center gap-1.5 h-[38px] px-3.5 rounded-[8px] text-[13px] font-semibold disabled:opacity-60" style={{ border: "1px solid rgb(var(--w) / 0.14)", color: "var(--hx-f5f5f7)" }} data-refresh-prompts>{refreshing === "done" ? <><Check size={14} /> Refreshed</> : <><RefreshCw size={14} className={refreshing === "busy" ? "animate-spin" : ""} /> Refresh</>}</button>
          {view === "queue" && <SelectToggle ms={ms} total={queue.length} noun="prompts" />}
          <button type="button" onClick={() => setAdding((a) => !a)} className="inline-flex items-center gap-1.5 h-[38px] px-4 rounded-[8px] text-[13px] font-semibold" style={{ background: "rgb(var(--w))", color: "rgb(var(--k))" }}><Plus size={14} /> New card</button>
        </div>
      </div>
      {err && <div className="rounded-[10px] px-4 py-3 text-[13px]" style={{ background: "rgb(var(--hx-ff453ac) / 0.1)", color: "var(--hx-ff453a)", border: "1px solid rgb(var(--hx-ff453ac) / 0.3)" }}>{err}</div>}
      {undo && <div className="flex items-center justify-between gap-3 rounded-[10px] px-4 py-2.5 text-[13px]" style={{ background: "rgb(var(--hx-30d158c) / 0.1)", border: "1px solid rgb(var(--hx-30d158c) / 0.35)", color: "var(--hx-f5f5f7)" }}><span>Marked sent: <strong>{undo.card.name}</strong> · {fmt(undo.card.sent_at)}</span><button type="button" onClick={() => void undoNow()} className="inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full text-[12.5px] font-semibold" style={{ border: "1px solid rgb(var(--w) / 0.2)" }}><Undo2 size={13} /> Undo</button></div>}

      {adding && (
        <form onSubmit={create} className="rounded-[12px] p-5 flex flex-col gap-3" style={card}>
          <div className="grid md:grid-cols-[1fr_140px_120px] gap-3">
            <input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name / label — e.g. Blitz prompt #1 — bulk load" className="h-[40px] rounded-[8px] px-3 text-[13.5px]" style={input} />
            <select value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value as Urgency })} className="h-[40px] rounded-[8px] px-2 text-[13px]" style={input}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
            <input value={form.send_order} onChange={(e) => setForm({ ...form, send_order: e.target.value.replace(/\D/g, "") })} placeholder={`Order (${queue.length + 1})`} className="h-[40px] rounded-[8px] px-3 text-[13px]" style={input} />
          </div>
          <textarea required value={form.prompt_text} onChange={(e) => setForm({ ...form, prompt_text: e.target.value })} rows={10} placeholder="Paste the full prompt exactly as it should be sent. Line breaks are kept; nothing is reformatted." className="rounded-[8px] px-3 py-2 text-[13px] font-mono leading-relaxed whitespace-pre" style={input} spellCheck={false} />
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 h-[36px] px-3.5 rounded-full text-[12.5px] cursor-pointer" style={{ border: "1px solid rgb(var(--w) / 0.14)", color: "var(--hx-f5f5f7)" }}><Paperclip size={14} /> Attach files<input type="file" multiple className="hidden" onChange={(e) => { setFiles(Array.from(e.target.files ?? [])); }} /></label>
            {files.map((f) => <span key={f.name} className="text-[12px] text-[color:var(--hx-a1a1a6)]">{f.name} · {kb(f.size)}</span>)}
            <div className="flex-1" />
            <button type="button" onClick={() => setAdding(false)} className="h-[36px] px-4 rounded-full text-[12.5px]" style={{ border: "1px solid rgb(var(--w) / 0.14)", color: "var(--hx-a1a1a6)" }}>Cancel</button>
            <button type="submit" disabled={saving} className="h-[36px] px-4 rounded-full text-[12.5px] font-semibold disabled:opacity-50" style={{ background: "rgb(var(--w))", color: "rgb(var(--k))" }}>{saving ? "Saving…" : "Add to queue"}</button>
          </div>
        </form>
      )}

      {view === "queue" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] px-4 py-3" style={card}>
          <div className="text-[12.5px] text-[color:var(--hx-a1a1a6)]">Sent everything? Tell Atlas (Muse) it&apos;s good to go — it gets a high-priority task to verify.{lastSync && <span className="ml-2 text-[color:var(--hx-6e6e73)]">· Auto-refreshes every 60s (last {new Date(lastSync).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })})</span>}</div>
          <button type="button" onClick={() => void notifyMuse()} disabled={notify.state === "busy"} className="inline-flex items-center gap-2 h-[40px] px-5 rounded-full text-[13.5px] font-semibold disabled:opacity-60" style={{ background: notify.state === "done" ? "var(--hx-30d158)" : "var(--hx-0a84ff)", color: "#fff" }} data-notify-muse>
            {notify.state === "done" ? <><Check size={15} /> Muse notified{notify.reused ? " (again)" : ""}</> : notify.state === "busy" ? "Notifying…" : <><BellRing size={15} /> Notify Muse</>}
          </button>
        </div>
      )}

      {view === "queue" && (
        !loaded ? <div className="text-[13px] text-[color:var(--hx-6e6e73)]">Loading…</div> : queue.length === 0 ? <div className="rounded-[12px] p-8 text-center text-[13px] text-[color:var(--hx-6e6e73)]" style={card}>Nothing queued. Add a card, or let Atlas add one through the agent API.</div> : (
          <div className="flex gap-4 overflow-x-auto pb-3 items-stretch" style={{ scrollSnapType: "x proximity" }}>
            {queue.map((c, i) => (
              <article key={c.id} className="shrink-0 w-[400px] rounded-[14px] p-5 flex flex-col gap-3" style={{ ...card, scrollSnapAlign: "start", ...(ms.isSelected(c.id) ? { borderColor: "var(--hx-0a84ff)" } : {}) }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">{ms.active && <SelectCircle checked={ms.isSelected(c.id)} onToggle={() => ms.toggle(c.id)} label={`Select ${c.name}`} />}<div className="text-[40px] font-semibold leading-none tracking-[-0.04em] text-[color:var(--hx-f5f5f7)]">{c.send_order}</div><div className="min-w-0"><div className="text-[14px] font-semibold text-[color:var(--hx-f5f5f7)] truncate" title={c.name}>{c.name}</div><div className="text-[11.5px] text-[color:var(--hx-6e6e73)]">Added {fmt(c.created_at)} · {c.source === "agent" ? "by agent" : c.created_by_label}</div><QueueAge createdAt={c.created_at} /></div></div>
                  <UrgencyBadge u={c.urgency} />
                </div>
                <pre className="flex-1 min-h-[200px] max-h-[320px] overflow-auto rounded-[10px] p-3 text-[12.5px] leading-relaxed font-mono whitespace-pre-wrap break-words text-[color:var(--hx-d0d0d0)]" style={{ background: "var(--hx-050505)", border: "1px solid rgb(var(--w) / 0.06)" }}>{c.prompt_text}</pre>
                {c.files.length > 0 && <div className="flex flex-col gap-1">{c.files.map((f) => <a key={f.id} href={`/api/team/prompts/files/${f.id}`} className="inline-flex items-center justify-between gap-2 h-[34px] px-3 rounded-[8px] text-[12.5px] text-[color:var(--hx-f5f5f7)]" style={{ background: "var(--hx-050505)", border: "1px solid rgb(var(--w) / 0.1)" }}><span className="inline-flex items-center gap-2 min-w-0"><Paperclip size={13} /><span className="truncate">{f.filename}</span><span className="text-[color:var(--hx-6e6e73)]">{kb(f.size_bytes)}</span></span><Download size={14} /></a>)}</div>}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <CopyButton text={c.prompt_text} />
                  <div className="flex items-center gap-1">
                    <button type="button" title="Move earlier" disabled={i === 0} onClick={() => void move(c.id, c.send_order - 1)} className="w-[30px] h-[30px] rounded-full inline-flex items-center justify-center disabled:opacity-30" style={{ border: "1px solid rgb(var(--w) / 0.14)", color: "var(--hx-a1a1a6)" }}><ArrowLeft size={13} /></button>
                    <button type="button" title="Move later" disabled={i === queue.length - 1} onClick={() => void move(c.id, c.send_order + 1)} className="w-[30px] h-[30px] rounded-full inline-flex items-center justify-center disabled:opacity-30" style={{ border: "1px solid rgb(var(--w) / 0.14)", color: "var(--hx-a1a1a6)" }}><ArrowRight size={13} /></button>
                    <label className="ml-2 inline-flex items-center gap-2 h-[34px] px-3 rounded-full text-[12.5px] cursor-pointer select-none" style={{ border: "1px solid rgb(var(--w) / 0.14)", color: "var(--hx-f5f5f7)" }}><input type="checkbox" checked={false} onChange={() => void done(c)} aria-label={`Mark "${c.name}" done`} />Done</label>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )
      )}

      {view === "sent" && (
        sent.length === 0 ? <div className="rounded-[12px] p-8 text-center text-[13px] text-[color:var(--hx-6e6e73)]" style={card}>No prompts sent yet.</div> : (
          <div className="flex flex-col gap-2">
            {sent.map((c) => (
              <article key={c.id} className="rounded-[12px] p-4" style={card}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0"><div className="text-[14px] font-semibold text-[color:var(--hx-f5f5f7)]">{c.name}</div><div className="text-[11.5px] text-[color:var(--hx-6e6e73)]">Sent {fmt(c.sent_at)}{waitedBeforeSend(c.created_at, c.sent_at) != null && <span className="text-[color:var(--hx-a1a1a6)]"> after {formatAge(waitedBeforeSend(c.created_at, c.sent_at)!)} in queue</span>} · added {fmt(c.created_at)} · {c.source === "agent" ? "by agent" : c.created_by_label}</div></div>
                  <div className="flex items-center gap-2"><UrgencyBadge u={c.urgency} /><CopyButton text={c.prompt_text} /><button type="button" onClick={() => setExpanded((x) => ({ ...x, [c.id]: !x[c.id] }))} className="inline-flex items-center gap-1 h-[34px] px-3 rounded-full text-[12.5px]" style={{ border: "1px solid rgb(var(--w) / 0.14)", color: "var(--hx-a1a1a6)" }}>{expanded[c.id] ? <><ChevronUp size={13} /> Hide</> : <><ChevronDown size={13} /> Full text</>}</button></div>
                </div>
                {expanded[c.id] && <pre className="mt-3 max-h-[420px] overflow-auto rounded-[10px] p-3 text-[12.5px] leading-relaxed font-mono whitespace-pre-wrap break-words text-[color:var(--hx-d0d0d0)]" style={{ background: "var(--hx-050505)", border: "1px solid rgb(var(--w) / 0.06)" }}>{c.prompt_text}</pre>}
                {c.files.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{c.files.map((f) => <a key={f.id} href={`/api/team/prompts/files/${f.id}`} className="inline-flex items-center gap-2 h-[30px] px-3 rounded-full text-[12px] text-[color:var(--hx-f5f5f7)]" style={{ border: "1px solid rgb(var(--w) / 0.12)" }}><Paperclip size={12} />{f.filename}<Download size={12} /></a>)}</div>}
              </article>
            ))}
          </div>
        )
      )}
      {view === "queue" && <BulkBar ms={ms} noun={prompts} actions={bulkActions} />}
      {ms.active && <div className="h-[96px]" />}
    </div>
  );
}
