"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, X, Send, Check, Loader2 } from "lucide-react";
import type { Reply } from "@/lib/assistant/types";

// Dashboard assistant (Layer 1): floating chat for /team (theme "dark") and the
// client portal (theme "light"). Reads answer instantly; writes come back as a
// confirmation card and only run when the user taps Confirm.
type Msg = { from: "me" | "bot"; text: string; reply?: Reply; done?: boolean };

export default function AssistantWidget({ endpoint, theme, title }: { endpoint: "/api/team/assistant" | "/api/dashboard/assistant"; theme: "dark" | "light"; title: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [briefed, setBriefed] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const dark = theme === "dark";
  const c = dark
    ? { panel: "#0b0b0c", border: "rgba(255,255,255,0.10)", text: "#f5f5f7", sub: "#8e8e93", me: "#ffffff", meText: "#000000", bot: "#161618", chip: "rgba(255,255,255,0.08)", accent: "#0a84ff", input: "#141416" }
    : { panel: "#ffffff", border: "rgba(0,0,0,0.10)", text: "#111111", sub: "#6b6b70", me: "#111111", meText: "#ffffff", bot: "#f3f3f5", chip: "rgba(0,0,0,0.06)", accent: "#0a64d8", input: "#f7f7f9" };

  useEffect(() => { scroller.current?.scrollTo({ top: 1e9, behavior: "smooth" }); }, [msgs, busy]);

  const call = async (body: Record<string, unknown>): Promise<Reply> => {
    const r = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({ text: "Couldn't reach the assistant." }));
    return (j.text ? j : { text: j.error || "Something went wrong." }) as Reply;
  };

  // Proactive: the first time the panel opens, show a briefing without being asked.
  useEffect(() => {
    if (!open || briefed) return; setBriefed(true); setBusy(true);
    call({ briefing: true }).then((reply) => setMsgs((m) => [...m, { from: "bot", text: reply.text, reply }])).finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const send = async (text: string) => {
    const t = text.trim(); if (!t || busy) return;
    setInput(""); setMsgs((m) => [...m, { from: "me", text: t.replace(/\s*(lead|msg):[0-9a-f-]{36}/gi, "") }]); setBusy(true);
    try { const reply = await call({ message: t }); setMsgs((m) => [...m, { from: "bot", text: reply.text, reply }]); } finally { setBusy(false); }
  };
  const confirm = async (i: number, yes: boolean) => {
    const m = msgs[i]; if (!m.reply?.confirm || m.done) return;
    setMsgs((all) => all.map((x, j) => (j === i ? { ...x, done: true } : x)));
    if (!yes) { setMsgs((all) => [...all, { from: "bot", text: "Cancelled — nothing changed." }]); return; }
    setBusy(true);
    try { const reply = await call({ confirm: { action: m.reply.confirm.action, token: m.reply.confirm.token } }); setMsgs((all) => [...all, { from: "bot", text: reply.text, reply }]); } finally { setBusy(false); }
  };

  if (pathname === "/team/chat" || pathname === "/dashboard/chat") return null; // the full-page chat IS the assistant there
  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} aria-label={`Open ${title}`} className="fixed bottom-5 right-5 z-[60] w-[52px] h-[52px] rounded-full flex items-center justify-center shadow-lg" style={{ background: c.me, color: c.meText }} data-theme-lock={dark ? "dark" : undefined}>
          <MessageCircle size={22} />
        </button>
      )}
      {open && (
        <div className="fixed bottom-5 right-5 z-[60] w-[min(400px,calc(100vw-24px))] h-[min(600px,calc(100vh-40px))] rounded-[16px] flex flex-col overflow-hidden shadow-2xl" style={{ background: c.panel, border: `1px solid ${c.border}`, color: c.text }} data-theme-lock={dark ? "dark" : undefined} role="dialog" aria-label={title}>
          <div className="flex items-center justify-between px-4 h-[50px] shrink-0" style={{ borderBottom: `1px solid ${c.border}` }}>
            <div><div className="text-[14px] font-semibold">{title}</div><div className="text-[10.5px]" style={{ color: c.sub }}>Answers instantly · asks before changing anything</div></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ color: c.sub }}><X size={18} /></button>
          </div>
          <div ref={scroller} className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2.5">
            {msgs.map((m, i) => m.from === "me" ? (
              <div key={i} className="self-end max-w-[85%] rounded-[14px] px-3 py-2 text-[13px] whitespace-pre-wrap" style={{ background: c.me, color: c.meText }}>{m.text}</div>
            ) : (
              <div key={i} className="self-start max-w-[92%] rounded-[14px] px-3 py-2.5 text-[13px] flex flex-col gap-2" style={{ background: c.bot }}>
                <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
                {m.reply?.items && m.reply.items.length > 0 && (
                  <ul className="flex flex-col gap-1">{m.reply.items.map((it, k) => <li key={k} className="text-[12.5px]">{it.href ? <Link href={it.href} className="font-medium hover:underline" onClick={() => setOpen(false)}>{it.label}</Link> : <span className="font-medium">{it.label}</span>}{it.sub && <span style={{ color: c.sub }}> · {it.sub}</span>}</li>)}</ul>
                )}
                {m.reply?.confirm && (
                  <div className="flex items-center gap-2 pt-1">
                    {m.done ? <span className="text-[11.5px]" style={{ color: c.sub }}>Answered</span> : <>
                      <button type="button" disabled={busy} onClick={() => void confirm(i, true)} className="inline-flex items-center gap-1 h-[30px] px-3 rounded-full text-[12px] font-semibold disabled:opacity-50" style={{ background: c.accent, color: "#fff" }}><Check size={13} /> Confirm</button>
                      <button type="button" disabled={busy} onClick={() => void confirm(i, false)} className="h-[30px] px-3 rounded-full text-[12px]" style={{ border: `1px solid ${c.border}` }}>Cancel</button>
                      {m.reply.confirm.cost && <span className="text-[11px]" style={{ color: c.sub }}>{m.reply.confirm.cost}</span>}
                    </>}
                  </div>
                )}
                {(m.reply?.options?.length || m.reply?.links?.length) ? (
                  <div className="flex flex-wrap gap-1.5">
                    {m.reply?.options?.map((o, k) => <button key={k} type="button" disabled={busy} onClick={() => void send(o.message)} className="h-[28px] px-2.5 rounded-full text-[11.5px] text-left" style={{ background: c.chip }}>{o.label}</button>)}
                    {m.reply?.links?.map((l, k) => <Link key={k} href={l.href} onClick={() => setOpen(false)} className="h-[28px] px-2.5 rounded-full text-[11.5px] inline-flex items-center font-medium" style={{ border: `1px solid ${c.border}` }}>{l.label} →</Link>)}
                  </div>
                ) : null}
                {m.reply?.suggestions && i === msgs.length - 1 && (
                  <div className="flex flex-wrap gap-1.5">{m.reply.suggestions.slice(0, 4).map((sug) => <button key={sug} type="button" disabled={busy} onClick={() => void send(sug)} className="h-[26px] px-2.5 rounded-full text-[11px]" style={{ background: c.chip, color: c.sub }}>{sug}</button>)}</div>
                )}
              </div>
            ))}
            {busy && <div className="self-start px-3 py-2 rounded-[14px]" style={{ background: c.bot, color: c.sub }}><Loader2 size={14} className="animate-spin" /></div>}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex items-center gap-2 p-3 shrink-0" style={{ borderTop: `1px solid ${c.border}` }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask or tell me to do something…" className="flex-1 h-[38px] rounded-full px-3.5 text-[13px] outline-none" style={{ background: c.input, color: c.text, border: `1px solid ${c.border}` }} />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="w-[38px] h-[38px] rounded-full flex items-center justify-center disabled:opacity-40" style={{ background: c.me, color: c.meText }}><Send size={15} /></button>
          </form>
        </div>
      )}
    </>
  );
}
