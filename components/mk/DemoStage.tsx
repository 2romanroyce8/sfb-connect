"use client";
import { useEffect, useMemo, useState } from "react";
import { TRADES, type Trade } from "@/lib/mk/trades";
import VoiceCall from "./VoiceCall";
import AuditPanel from "./AuditPanel";

// Every panel is a SIMULATION driven by a fixed script (no model, no microphone, no network call) and says so on screen.
// The businesses are FICTIONAL, invented for this demo. Real sandboxed voice/chat/audit modules live inside the agency's demo builder.
type Turn = { from: "caller" | "ai"; text: string };
function receptionist(t: Trade): { prompt: string; turns: Turn[] }[] {
  return [
    { prompt: `"${t.asks[0]}"`, turns: [{ from: "caller", text: t.asks[0] }, { from: "ai", text: `Thanks for calling ${t.biz}. I can help with that. Let me get a couple of details so the right person can follow up. What's your name and the best number?` }] },
    { prompt: `"${t.asks[1]}"`, turns: [{ from: "caller", text: t.asks[1] }, { from: "ai", text: `${t.service[0].toUpperCase() + t.service.slice(1)} is quoted based on your situation, so I'll note what you need and book a time to confirm the details. Is there anything urgent right now?` }] },
    { prompt: `"${t.asks[2]}"`, turns: [{ from: "caller", text: t.asks[2] }, { from: "ai", text: "Happy to set that up. Which day works best?" }, { from: "caller", text: "Thursday morning." }, { from: "ai", text: `Thursday morning noted for ${t.service}. In a connected setup this lands on the calendar; in this demo it is simulated, so nothing was booked.` }] },
  ];
}
function chatbot(t: Trade): { prompt: string; turns: Turn[] }[] {
  return [
    { prompt: `"What services do you offer?"`, turns: [{ from: "caller", text: "What services do you offer?" }, { from: "ai", text: `I answer from the details ${t.biz} approved: services, service area (${t.city} and nearby) and hours. If I can't find something, I hand you to a person.` }] },
    { prompt: `"I'd like a quote"`, turns: [{ from: "caller", text: "I'd like a quote." }, { from: "ai", text: "Sure. What do you need done, and when would you like it?" }, { from: "caller", text: `${t.service[0].toUpperCase() + t.service.slice(1)}, next week.` }, { from: "ai", text: "Thanks. That's enough to qualify the request. In production it creates a lead for the team; in this demo the handoff is simulated." }] },
    { prompt: `"Can I talk to a person?"`, turns: [{ from: "caller", text: "Can I talk to a human?" }, { from: "ai", text: "Of course. Handing you to the team now (simulated handoff in this demo)." }] },
  ];
}
const MISSED = (t: Trade): { t: string; text: string; who: "sys" | "ai" | "cust" }[] => [
  { t: "10:02", who: "sys", text: "Inbound call, not answered" },
  { t: "10:02", who: "ai", text: `Sorry we missed you. This is ${t.biz}. What can we help with?` },
  { t: "10:04", who: "cust", text: `I need ${t.service}.` },
  { t: "10:04", who: "ai", text: "Happy to help. What's your zip code?" },
  { t: "10:06", who: "cust", text: "33131." },
  { t: "10:06", who: "ai", text: "Got it. Does today at 3pm or tomorrow at 9am work for a visit?" },
  { t: "10:07", who: "sys", text: "Appointment request created (simulated)" },
];

const Sim = () => <span className="mk-sim">Simulation</span>;
const bubbleBlue = { background: "var(--mk-blue)", color: "var(--mk-on-blue)" } as const;

function Chat({ script, label }: { script: { prompt: string; turns: Turn[] }[]; label: string }) {
  const [shown, setShown] = useState<Turn[]>([]);
  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap"><Sim /><span className="text-[13.5px]" style={{ color: "var(--mk-muted)" }}>{label}. Scripted: no live AI, microphone or real booking.</span></div>
      <div className="rounded-[18px] p-4 min-h-[230px] flex flex-col gap-2" style={{ background: "var(--mk-bg2)", border: "1px solid var(--mk-border)" }} aria-live="polite">
        {shown.length === 0 && <div className="text-[14px] m-auto" style={{ color: "var(--mk-muted)" }}>Pick something to say below.</div>}
        {shown.map((t, i) => (
          <div key={i} className={`max-w-[85%] rounded-[14px] px-4 py-2.5 text-[14.5px] ${t.from === "caller" ? "self-end" : "self-start"}`} style={t.from === "caller" ? bubbleBlue : { background: "var(--mk-white)", border: "1px solid var(--mk-border)" }}>{t.text}</div>
        ))}
      </div>
      <div className="mt-4"><div className="text-[11.5px] uppercase tracking-[0.12em] mb-2" style={{ color: "var(--mk-muted)" }}>Try asking</div>
        <div className="flex flex-wrap gap-2">
          {script.map((s) => <button key={s.prompt} type="button" onClick={() => setShown(s.turns)} className="mk-btn mk-btn-ghost" style={{ height: 40, fontSize: 13.5 }}>{s.prompt}</button>)}
          {shown.length > 0 && <button type="button" onClick={() => setShown([])} className="text-[13px] px-2" style={{ color: "var(--mk-muted)" }}>Reset</button>}
        </div></div>
    </div>
  );
}

function Roi() {
  const [calls, setCalls] = useState(200); const [missed, setMissed] = useState(25); const [value, setValue] = useState(450); const [conv, setConv] = useState(20); const [cost, setCost] = useState(300);
  const missedCalls = calls * (missed / 100); const jobs = missedCalls * (conv / 100); const revenue = jobs * value; const net = revenue - cost;
  const f = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const field = (label: string, v: number, set: (n: number) => void, unit?: string) => (
    <label className="flex flex-col gap-1.5 text-[13px]" style={{ color: "var(--mk-muted)" }}>{label}
      <div className="relative"><input type="number" min={0} className="mk-input" value={v} onChange={(e) => set(Math.max(0, Number(e.target.value) || 0))} />{unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px]">{unit}</span>}</div>
    </label>
  );
  return (
    <div>
      <p className="text-[13.5px] mb-4" style={{ color: "var(--mk-muted)" }}>A transparent estimate from your own inputs. It is an assumption-based opportunity, never a guaranteed result.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{field("Calls per month", calls, setCalls)}{field("Missed calls", missed, setMissed, "%")}{field("Avg customer value", value, setValue, "$")}{field("Missed-call to job rate", conv, setConv, "%")}{field("Monthly software cost", cost, setCost, "$")}</div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[["Missed calls", f(missedCalls)], ["Possible extra jobs", jobs.toFixed(1)], ["Opportunity after software cost", `$${f(net)}/mo`]].map(([k, v]) => (
          <div key={k} className="rounded-[16px] p-5" style={{ background: "var(--mk-bg2)", border: "1px solid var(--mk-border)" }}><div className="text-[12px] uppercase tracking-wide" style={{ color: "var(--mk-muted)" }}>{k}</div><div className="text-[30px] font-semibold mt-1">{v}</div></div>))}
      </div>
      <p className="mt-4 text-[12.5px]" style={{ color: "var(--mk-muted)" }}>Formula: calls × missed % × job rate × customer value − software cost = {f(calls)} × {missed}% × {conv}% × ${f(value)} − ${f(cost)}.</p>
    </div>
  );
}

const TABS = ["AI receptionist", "Website chatbot", "Website audit", "Missed-call text-back", "ROI calculator"] as const;
export default function DemoStage({ showTrades = true }: { showTrades?: boolean }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("AI receptionist");
  const [tradeKey, setTradeKey] = useState(TRADES[0].key);
  const [voiceOn, setVoiceOn] = useState(false);
  useEffect(() => { fetch("/api/demo/voice").then((r) => r.json()).then((j) => setVoiceOn(!!j.configured)).catch(() => setVoiceOn(false)); }, []);
  const trade = TRADES.find((t) => t.key === tradeKey) ?? TRADES[0];
  const rec = useMemo(() => receptionist(trade), [trade]); const bot = useMemo(() => chatbot(trade), [trade]); const missed = useMemo(() => MISSED(trade), [trade]);
  const needsTrade = tab === "AI receptionist" || tab === "Website chatbot" || tab === "Missed-call text-back";
  return (
    <div>
      {showTrades && (
        <div className="mb-3">
          <div className="mx-auto flex flex-wrap items-center justify-center gap-1.5 rounded-[999px] p-2 w-fit max-w-full" style={{ background: "var(--mk-bg2)", border: "1px solid var(--mk-border)" }} role="tablist" aria-label="Pick a trade">
            <span className="px-4 text-[12px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--mk-muted)" }}>Pick a trade</span>
            {TRADES.map((t) => <button key={t.key} role="tab" aria-selected={tradeKey === t.key} type="button" onClick={() => setTradeKey(t.key)} className="rounded-full px-4 h-[38px] text-[13.5px] font-medium" style={tradeKey === t.key ? { background: "var(--mk-ink)", color: "var(--mk-white)" } : { color: "var(--mk-text)" }}>{t.label}</button>)}
          </div>
          <p className="text-center text-[13px] mt-3" style={{ color: "var(--mk-muted)" }}>You are about to try the demo for <strong style={{ color: "var(--mk-text)" }}>{trade.biz}</strong>, a fictional business invented for this demo.</p>
        </div>
      )}
      <div className="mk-card p-5 md:p-9 mt-6" style={{ borderRadius: 32 }}>
        <div className="flex flex-wrap gap-2 mb-7" role="tablist" aria-label="Demo modules">
          {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)} className="mk-btn" style={{ height: 40, fontSize: 14, ...(tab === t ? { background: "var(--mk-blue)", color: "var(--mk-on-blue)" } : { background: "var(--mk-white)", border: "1px solid var(--mk-border)", color: "var(--mk-text)" }) }}>{t}</button>)}
        </div>
        {tab === "AI receptionist" && voiceOn && <VoiceCall key={trade.key} trade={trade.key} label={`A real call to the ${trade.label.toLowerCase()} receptionist`} />}
        {tab === "AI receptionist" && !voiceOn && <Chat script={rec} label={`A caller talks to the ${trade.label.toLowerCase()} receptionist`} />}
        {tab === "Website chatbot" && <Chat script={bot} label={`A visitor chats with the ${trade.label.toLowerCase()} site assistant`} />}
        {tab === "Website audit" && <AuditPanel />}
        {tab === "Missed-call text-back" && (
          <div>
            <div className="flex items-center gap-3 mb-4 flex-wrap"><Sim /><span className="text-[13.5px]" style={{ color: "var(--mk-muted)" }}>Simulated phone events. No real call or text is sent.</span></div>
            <ol className="flex flex-col gap-2.5">{missed.map((m, i) => (
              <li key={i} className="flex gap-3 items-start text-[14.5px]"><span className="w-[46px] shrink-0 text-[12px] pt-2" style={{ color: "var(--mk-muted)" }}>{m.t}</span>
                <span className="rounded-[12px] px-3.5 py-2" style={m.who === "cust" ? bubbleBlue : { background: "var(--mk-bg2)", border: "1px solid var(--mk-border)", color: m.who === "sys" ? "var(--mk-muted)" : "var(--mk-text)" }}>{m.text}</span></li>))}</ol>
          </div>
        )}
        {tab === "ROI calculator" && <Roi />}
        {!needsTrade && showTrades && tab !== "ROI calculator" && null}
      </div>
    </div>
  );
}
