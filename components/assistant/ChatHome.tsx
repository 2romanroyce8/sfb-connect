"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Check, Loader2 } from "lucide-react";
import type { Reply } from "@/lib/assistant/types";

// Chat-first home (Roman, 2026-10-22): the first screen after sign-in for the team dashboard and the client portal.
// Same assistant, same endpoints and same confirm-before-write protocol as the floating widget — this is just the full-page surface.
// Reads answer instantly; anything that changes data comes back as a confirmation card and only runs on Confirm.
type Msg = { from: "me" | "bot"; text: string; reply?: Reply; done?: boolean };
type Register = "dark" | "light"; // the AUTHORED look of the surface it sits in (team = dark, client portal = light)

const CHIPS = {
  team: ["Brief me", "Who do I call today?", "Show my pipeline", "Any stuck deals?"],
  client: ["What's left to finish setup?", "How many credits do I have?", "Any emails waiting for my approval?", "Did anyone reply?"],
};

export default function ChatHome({ endpoint, register, name, audience }: { endpoint: "/api/team/assistant" | "/api/dashboard/assistant"; register: Register; name: string; audience: "team" | "client" }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [brief, setBrief] = useState<Reply | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const dark = register === "dark";
  // Authored-register tokens only (no literal colors): borders/fills come from --w (dark surfaces) or --k (light surfaces).
  const ink = dark ? "var(--hx-ffffff)" : "var(--hx-1d1d1f)";
  const sub = dark ? "var(--hx-a1a1a6)" : "var(--hx-86868b)";
  const edge = dark ? "rgb(var(--w) / 0.12)" : "rgb(var(--k) / 0.12)";
  const soft = dark ? "rgb(var(--w) / 0.06)" : "rgb(var(--k) / 0.05)";
  const solid = dark ? "var(--hx-ffffff)" : "var(--hx-000000)";
  const onSolid = dark ? "var(--hx-000000)" : "var(--hx-ffffff)";
  const started = msgs.length > 0;

  const call = async (body: Record<string, unknown>): Promise<Reply> => {
    const r = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({ text: "Couldn't reach the assistant." }));
    return (j.text ? j : { text: j.error || "Something went wrong." }) as Reply;
  };
  useEffect(() => { call({ briefing: true }).then(setBrief).catch(() => undefined); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { scroller.current?.scrollTo({ top: 1e9, behavior: "smooth" }); }, [msgs, busy]);
  useEffect(() => { const a = area.current; if (!a) return; a.style.height = "auto"; a.style.height = `${Math.min(a.scrollHeight, 200)}px`; }, [input]);

  const send = async (text: string) => {
    const t = text.trim(); if (!t || busy) return;
    setInput(""); setMsgs((m) => [...m, { from: "me", text: t }]); setBusy(true);
    try { const reply = await call({ message: t }); setMsgs((m) => [...m, { from: "bot", text: reply.text, reply }]); } finally { setBusy(false); }
  };
  const confirm = async (i: number, yes: boolean) => {
    const m = msgs[i]; if (!m.reply?.confirm || m.done) return;
    setMsgs((all) => all.map((x, j) => (j === i ? { ...x, done: true } : x)));
    if (!yes) { setMsgs((all) => [...all, { from: "bot", text: "Cancelled — nothing changed." }]); return; }
    setBusy(true);
    try { const reply = await call({ confirm: { action: m.reply.confirm.action, token: m.reply.confirm.token } }); setMsgs((all) => [...all, { from: "bot", text: reply.text, reply }]); } finally { setBusy(false); }
  };

  const composer = (
    <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="w-full max-w-[760px] mx-auto rounded-[24px] p-3 flex items-end gap-2" style={{ background: soft, border: `1px solid ${edge}` }}>
      <textarea ref={area} rows={started ? 1 : 3} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
        placeholder={audience === "team" ? "Ask about leads, pipeline, follow-ups — or tell me what to do…" : "Ask about your account, credits, emails, meetings — or tell me what to do…"}
        aria-label="Message the assistant" className="flex-1 resize-none bg-transparent outline-none text-[15px] leading-relaxed px-2 py-1.5" style={{ color: ink }} />
      <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="w-[38px] h-[38px] shrink-0 rounded-full flex items-center justify-center disabled:opacity-35" style={{ background: solid, color: onSolid }}><ArrowUp size={18} /></button>
    </form>
  );

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]" style={{ color: ink }}>
      {!started ? (
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 gap-7">
          <div className="text-center max-w-[760px]">
            <h1 className="text-[34px] sm:text-[48px] font-semibold tracking-tight leading-[1.08]">What can I help with{name ? `, ${name}` : ""}?</h1>
            <p className="mt-3 text-[15px]" style={{ color: sub }}>{audience === "team" ? "Ask anything about the pipeline, or tell me to make a change. Reads are instant; I ask before changing anything." : "Ask about your account or tell me what to do. I answer instantly and ask before changing anything."}</p>
          </div>
          {composer}
          <div className="flex flex-wrap justify-center gap-2 max-w-[760px]">
            {CHIPS[audience].map((c) => <button key={c} type="button" onClick={() => void send(c)} disabled={busy} className="h-[38px] px-4 rounded-full text-[13px]" style={{ border: `1px solid ${edge}`, color: ink }}>{c}</button>)}
          </div>
          {brief && (
            <div className="w-full max-w-[760px] rounded-[18px] p-5 flex flex-col gap-2.5" style={{ border: `1px solid ${edge}` }}>
              <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: sub }}>Today</div>
              <div className="text-[14px] whitespace-pre-wrap leading-relaxed">{brief.text}</div>
              {brief.items && brief.items.length > 0 && <ul className="flex flex-col gap-1">{brief.items.slice(0, 6).map((it, k) => <li key={k} className="text-[13px]">{it.href ? <Link href={it.href} className="font-medium hover:underline">{it.label}</Link> : <span className="font-medium">{it.label}</span>}{it.sub && <span style={{ color: sub }}> · {it.sub}</span>}</li>)}</ul>}
              {brief.links && brief.links.length > 0 && <div className="flex flex-wrap gap-2 pt-1">{brief.links.map((l, k) => <Link key={k} href={l.href} className="h-[30px] px-3 rounded-full text-[12px] inline-flex items-center font-medium" style={{ border: `1px solid ${edge}` }}>{l.label} →</Link>)}</div>}
            </div>
          )}
        </div>
      ) : (
        <>
          <div ref={scroller} className="flex-1 overflow-y-auto px-5 pt-8 pb-4">
            <div className="max-w-[760px] mx-auto flex flex-col gap-4">
              {msgs.map((m, i) => m.from === "me" ? (
                <div key={i} className="self-end max-w-[85%] rounded-[18px] px-4 py-2.5 text-[14.5px] whitespace-pre-wrap" style={{ background: solid, color: onSolid }}>{m.text}</div>
              ) : (
                <div key={i} className="self-start max-w-[94%] rounded-[18px] px-4 py-3 text-[14.5px] flex flex-col gap-2.5" style={{ background: soft }}>
                  <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
                  {m.reply?.items && m.reply.items.length > 0 && <ul className="flex flex-col gap-1">{m.reply.items.map((it, k) => <li key={k} className="text-[13.5px]">{it.href ? <Link href={it.href} className="font-medium hover:underline">{it.label}</Link> : <span className="font-medium">{it.label}</span>}{it.sub && <span style={{ color: sub }}> · {it.sub}</span>}</li>)}</ul>}
                  {m.reply?.confirm && (
                    <div className="flex items-center gap-2 pt-1">
                      {m.done ? <span className="text-[12px]" style={{ color: sub }}>Answered</span> : <>
                        <button type="button" disabled={busy} onClick={() => void confirm(i, true)} className="inline-flex items-center gap-1 h-[32px] px-4 rounded-full text-[13px] font-semibold disabled:opacity-50" style={{ background: solid, color: onSolid }}><Check size={14} /> Confirm</button>
                        <button type="button" disabled={busy} onClick={() => void confirm(i, false)} className="h-[32px] px-4 rounded-full text-[13px]" style={{ border: `1px solid ${edge}` }}>Cancel</button>
                        {m.reply.confirm.cost && <span className="text-[12px]" style={{ color: sub }}>{m.reply.confirm.cost}</span>}
                      </>}
                    </div>
                  )}
                  {(m.reply?.options?.length || m.reply?.links?.length) ? (
                    <div className="flex flex-wrap gap-2">
                      {m.reply?.options?.map((o, k) => <button key={k} type="button" disabled={busy} onClick={() => void send(o.message)} className="h-[30px] px-3 rounded-full text-[12.5px] text-left" style={{ border: `1px solid ${edge}` }}>{o.label}</button>)}
                      {m.reply?.links?.map((l, k) => <Link key={k} href={l.href} className="h-[30px] px-3 rounded-full text-[12.5px] inline-flex items-center font-medium" style={{ border: `1px solid ${edge}` }}>{l.label} →</Link>)}
                    </div>
                  ) : null}
                  {m.reply?.suggestions && i === msgs.length - 1 && (
                    <div className="flex flex-wrap gap-2">{m.reply.suggestions.slice(0, 4).map((s) => <button key={s} type="button" disabled={busy} onClick={() => void send(s)} className="h-[28px] px-3 rounded-full text-[12px]" style={{ background: soft, color: sub }}>{s}</button>)}</div>
                  )}
                </div>
              ))}
              {busy && <div className="self-start px-4 py-3 rounded-[18px]" style={{ background: soft, color: sub }}><Loader2 size={15} className="animate-spin" /></div>}
            </div>
          </div>
          <div className="px-5 pb-6 pt-2">{composer}</div>
        </>
      )}
    </div>
  );
}
