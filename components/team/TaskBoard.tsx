"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Task = { id: string; title: string; owner_agent: string; status: string; priority: string; due: string | null; context: string | null; result: string | null; evidence_links: string[]; requires_review: boolean; reviewer_agent: string | null; review_verdict: string | null; review_note: string | null; reviewed_by: string | null; created_by: string; claimed_by: string | null; created_at: string; updated_at: string; result_posted_at: string | null };
type Msg = { id: string; from_agent: string; to_agent: string | null; body: string; created_at: string };

const STATUSES = ["open", "claimed", "in_progress", "in_review", "done", "rejected", "blocked", "canceled"];
const AGENTS = ["atlas", "hyperagent", "roman"];
const STATUS_COLOR: Record<string, string> = { open: "#A1A1A6", claimed: "#0A84FF", in_progress: "#0A84FF", in_review: "#FFD60A", done: "#30D158", rejected: "#FF453A", blocked: "#FF9F0A", canceled: "#6E6E73" };
const PRIO_COLOR: Record<string, string> = { urgent: "#FF453A", high: "#FF9F0A", normal: "#A1A1A6", low: "#6E6E73" };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");
const field: React.CSSProperties = { background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F5F7" };

/** Agent task board: what Atlas and HyperAgent are doing for each other. Owner can create, review, cancel, and message. */
export default function TaskBoard({ isOwner }: { isOwner: boolean }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agent, setAgent] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<Task | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: "", owner_agent: "hyperagent", priority: "normal", context: "", requires_review: true });
  const [note, setNote] = useState("");
  const [chat, setChat] = useState("");

  const load = useCallback(async () => {
    const p = new URLSearchParams(); if (agent) p.set("owner_agent", agent); if (status) p.set("status", status);
    const r = await fetch(`/api/team/tasks?${p}`, { cache: "no-store" }); const j = await r.json();
    if (r.ok) setTasks(j.tasks); else setMsg(j.error);
  }, [agent, status]);
  useEffect(() => { void load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const openTask = async (t: Task) => { setOpen(t); setNote(""); setChat(""); const r = await fetch(`/api/team/tasks?task_id=${t.id}`, { cache: "no-store" }); const j = await r.json(); if (r.ok) { setOpen(j.task); setMessages(j.messages); } };
  const act = async (body: Record<string, unknown>) => {
    setMsg(null);
    const r = await fetch("/api/team/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json();
    if (!r.ok) { setMsg(j.error); return false; }
    await load(); if (open && j.task) setOpen(j.task); if (open && body.action === "message") openTask(open); return true;
  };

  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, tasks.filter((t) => t.status === s).length])), [tasks]);

  return (
    <div className="px-8 py-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="text-[20px] font-semibold text-[#F5F5F7]">Agent Tasks</div>
          <div className="text-[13px] text-[#6E6E73] mt-1">Atlas and HyperAgent hand work to each other here. Anything touching production or customers needs the other agent&apos;s review before it counts as done.</div>
        </div>
        {isOwner && <button onClick={() => setShowNew((v) => !v)} className="h-[34px] px-4 rounded-[8px] bg-white text-black text-[12.5px] font-semibold shrink-0">{showNew ? "Close" : "New task"}</button>}
      </div>

      {showNew && isOwner && (
        <form onSubmit={async (e) => { e.preventDefault(); if (await act({ action: "create", ...form })) { setShowNew(false); setForm({ title: "", owner_agent: "hyperagent", priority: "normal", context: "", requires_review: true }); } }} className="rounded-[12px] p-4 mb-6 flex flex-col gap-2 max-w-[720px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <input required minLength={3} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title (imperative: 'Add dedup to Exa adapter')" className="h-[36px] rounded-[8px] px-3 text-[13px] outline-none" style={field} />
          <div className="flex gap-2">
            <select value={form.owner_agent} onChange={(e) => setForm({ ...form, owner_agent: e.target.value })} className="h-[34px] rounded-[8px] px-2 text-[12.5px] outline-none" style={field}>{AGENTS.map((a) => <option key={a} value={a}>Owner: {a}</option>)}</select>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="h-[34px] rounded-[8px] px-2 text-[12.5px] outline-none" style={field}>{["low", "normal", "high", "urgent"].map((p) => <option key={p} value={p}>{p}</option>)}</select>
            <label className="flex items-center gap-1.5 text-[12px] text-[#A1A1A6]"><input type="checkbox" checked={form.requires_review} onChange={(e) => setForm({ ...form, requires_review: e.target.checked })} /> requires review</label>
          </div>
          <textarea value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} rows={4} placeholder="Brief: what, why, acceptance criteria, links" className="rounded-[8px] px-3 py-2 text-[13px] outline-none" style={field} />
          <button type="submit" className="self-start h-[34px] px-4 rounded-[8px] bg-white text-black text-[12.5px] font-semibold">Create</button>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select value={agent} onChange={(e) => setAgent(e.target.value)} className="h-[32px] rounded-[8px] px-2 text-[12.5px] outline-none" style={field}><option value="">All agents</option>{AGENTS.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-[32px] rounded-[8px] px-2 text-[12.5px] outline-none" style={field}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select>
        <div className="flex flex-wrap gap-1.5 ml-1">{STATUSES.filter((s) => counts[s]).map((s) => <span key={s} className="text-[11px] px-2 py-0.5 rounded-full" style={{ color: STATUS_COLOR[s], border: `1px solid ${STATUS_COLOR[s]}55` }}>{s.replace("_", " ")} {counts[s]}</span>)}</div>
      </div>
      {msg && <div className="text-[12px] text-[#FF9F9A] mb-3">{msg}</div>}

      <div className="grid lg:grid-cols-[1fr_1.1fr] gap-4">
        <div className="rounded-[12px] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          {tasks.length === 0 ? <div className="p-8 text-center text-[13px] text-[#6E6E73]">No tasks match. Agents create tasks through the connector; owners with the New task button.</div> : (
            <ul className="divide-y" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              {tasks.map((t) => (
                <li key={t.id}><button onClick={() => openTask(t)} className="w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors" style={{ background: open?.id === t.id ? "#121212" : undefined }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[13px] text-[#F5F5F7] truncate">{t.title}</div>
                    <span className="text-[10.5px] uppercase tracking-wide shrink-0" style={{ color: STATUS_COLOR[t.status] }}>{t.status.replace("_", " ")}</span>
                  </div>
                  <div className="text-[11.5px] text-[#6E6E73] mt-0.5"><span style={{ color: PRIO_COLOR[t.priority] }}>{t.priority}</span> · {t.created_by} → {t.owner_agent}{t.requires_review ? ` · review: ${t.reviewer_agent}` : ""} · {fmt(t.updated_at)}</div>
                </button></li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-[12px] p-5 min-h-[300px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          {!open ? <div className="text-[13px] text-[#6E6E73]">Select a task to see its brief, result, evidence and thread.</div> : (
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="text-[16px] font-semibold text-[#F5F5F7]">{open.title}</div>
                  <span className="text-[10.5px] uppercase tracking-wide shrink-0" style={{ color: STATUS_COLOR[open.status] }}>{open.status.replace("_", " ")}</span>
                </div>
                <div className="text-[11.5px] text-[#6E6E73] mt-1">Created by {open.created_by} · owner {open.owner_agent} · {open.claimed_by ? `claimed by ${open.claimed_by}` : "unclaimed"} · priority {open.priority}{open.due ? ` · due ${fmt(open.due)}` : ""}</div>
              </div>
              {open.context && <Section label="Brief">{open.context}</Section>}
              {open.result && <Section label={`Result${open.result_posted_at ? ` · ${fmt(open.result_posted_at)}` : ""}`}>{open.result}</Section>}
              {open.evidence_links.length > 0 && <div><div className="text-[11px] uppercase tracking-wide text-[#6E6E73] mb-1">Evidence</div><ul className="flex flex-col gap-1">{open.evidence_links.map((l) => <li key={l}><a href={l} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[#0A84FF] underline underline-offset-2 break-all">{l}</a></li>)}</ul></div>}
              {open.review_verdict && <Section label={`Review · ${open.review_verdict.replace("_", " ")} by ${open.reviewed_by}`}>{open.review_note || "—"}</Section>}
              {isOwner && open.status === "in_review" && (
                <div className="rounded-[10px] p-3 flex flex-col gap-2" style={{ background: "rgba(255,214,10,0.06)", border: "1px solid rgba(255,214,10,0.25)" }}>
                  <div className="text-[12px] text-[#FFD60A]">Awaiting review by {open.reviewer_agent}. As owner you may review it yourself.</div>
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Review note" className="h-[32px] rounded-[8px] px-3 text-[12.5px] outline-none" style={field} />
                  <div className="flex gap-2">{(["approved", "changes_requested", "rejected"] as const).map((v) => <button key={v} onClick={() => act({ action: "review", task_id: open.id, verdict: v, note })} className="h-[30px] px-3 rounded-[7px] text-[12px] font-semibold" style={{ background: v === "approved" ? "#30D158" : v === "rejected" ? "rgba(255,69,58,0.15)" : "#101010", color: v === "approved" ? "#000" : v === "rejected" ? "#FF6961" : "#F5F5F7", border: "1px solid rgba(255,255,255,0.12)" }}>{v.replace("_", " ")}</button>)}</div>
                </div>
              )}
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[#6E6E73] mb-1.5">Thread</div>
                {messages.length === 0 ? <div className="text-[12px] text-[#6E6E73]">No messages yet.</div> : (
                  <ul className="flex flex-col gap-2">{messages.map((m) => <li key={m.id} className="rounded-[8px] p-2.5" style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.06)" }}><div className="text-[11px] text-[#6E6E73] mb-1">{m.from_agent}{m.to_agent ? ` → ${m.to_agent}` : ""} · {fmt(m.created_at)}</div><div className="text-[12.5px] text-[#F5F5F7] whitespace-pre-wrap">{m.body}</div></li>)}</ul>
                )}
                {isOwner && <form onSubmit={async (e) => { e.preventDefault(); if (await act({ action: "message", task_id: open.id, body: chat })) setChat(""); }} className="flex gap-2 mt-2"><input value={chat} onChange={(e) => setChat(e.target.value)} placeholder="Message the agents on this task" className="flex-1 h-[32px] rounded-[8px] px-3 text-[12.5px] outline-none" style={field} /><button type="submit" className="h-[32px] px-3 rounded-[7px] text-[12px] font-semibold bg-white text-black">Send</button></form>}
              </div>
              {isOwner && !["done", "canceled"].includes(open.status) && <button onClick={() => { if (confirm("Cancel this task?")) act({ action: "cancel", task_id: open.id }); }} className="self-start text-[12px] text-[#FF6961] underline underline-offset-2">Cancel task</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="text-[11px] uppercase tracking-wide text-[#6E6E73] mb-1">{label}</div><div className="text-[13px] text-[#D1D1D6] whitespace-pre-wrap leading-relaxed">{children}</div></div>;
}
