"use client";
import { useState } from "react";

// Every panel here is a SIMULATION driven by a fixed script (no model, no microphone, no network call) and says so on screen.
// Real sandboxed voice/chat/audit modules live inside the agency's demo builder; nothing below is presented as live.
type Turn = { from: "caller" | "ai"; text: string };
const RECEPTIONIST: { prompt: string; turns: Turn[] }[] = [
  { prompt: "Ask about pricing", turns: [{ from: "caller", text: "How much does a roof inspection cost?" }, { from: "ai", text: "Inspections are quoted per property, so I'll grab a few details and book a time that works. What's the address area, and is there a leak right now?" }] },
  { prompt: "Ask about hours", turns: [{ from: "caller", text: "Are you open on Saturdays?" }, { from: "ai", text: "I can check the schedule for you. Saturday has morning appointments available. Would you like me to hold one?" }] },
  { prompt: "Book an appointment", turns: [{ from: "caller", text: "I'd like someone to come out this week." }, { from: "ai", text: "Happy to set that up. Which day works best, and what's the best number to confirm with?" }, { from: "caller", text: "Thursday morning." }, { from: "ai", text: "Thursday morning noted. In a connected setup this lands on the calendar; in this demo it is simulated, so nothing was booked." }] },
];
const CHATBOT: { prompt: string; turns: Turn[] }[] = [
  { prompt: "What services do you offer?", turns: [{ from: "caller", text: "What services do you offer?" }, { from: "ai", text: "The assistant answers from the business details your agency approved: services, service area and hours. Anything it can't find, it hands to a person." }] },
  { prompt: "I need a quote", turns: [{ from: "caller", text: "I need a quote." }, { from: "ai", text: "Sure. Is this a repair or a full replacement, and when would you like it done?" }, { from: "caller", text: "Replacement, next month." }, { from: "ai", text: "Thanks. That's enough to qualify the request. In production it creates a lead for the team; in this demo the handoff is simulated." }] },
  { prompt: "Talk to a person", turns: [{ from: "caller", text: "Can I talk to a human?" }, { from: "ai", text: "Of course. Handing you to the team now (simulated handoff in this demo)." }] },
];
const MISSED: { t: string; text: string; who: "sys" | "ai" | "cust" }[] = [
  { t: "10:02", who: "sys", text: "Inbound call, not answered" },
  { t: "10:02", who: "ai", text: "Sorry we missed you. What can we help with?" },
  { t: "10:04", who: "cust", text: "My AC stopped cooling." },
  { t: "10:04", who: "ai", text: "Sorry to hear that. Is the unit running at all, and what's your zip code?" },
  { t: "10:06", who: "cust", text: "It's on but warm. 33131." },
  { t: "10:06", who: "ai", text: "Got it. Does today at 3pm or tomorrow at 9am work for a visit?" },
  { t: "10:07", who: "sys", text: "Appointment request created (simulated)" },
];
const AUDIT = [
  { check: "HTTPS", result: "Pass", note: "Site served over a valid certificate." },
  { check: "Page title", result: "Needs work", note: "Title is missing the city and service." },
  { check: "Meta description", result: "Missing", note: "No description tag found on the homepage." },
  { check: "Heading structure", result: "Pass", note: "One H1 followed by ordered H2 sections." },
  { check: "Mobile viewport", result: "Pass", note: "Viewport tag present." },
  { check: "Contact info", result: "Needs work", note: "Phone number is an image, not text." },
];

function Sim() { return <span className="mk-sim">Simulation</span>; }

function Chat({ script, label }: { script: typeof RECEPTIONIST; label: string }) {
  const [shown, setShown] = useState<Turn[]>([]);
  return (
    <div>
      <div className="flex items-center gap-3 mb-4"><Sim /><span className="text-[13px]" style={{ color: "var(--mk-muted)" }}>{label}. Scripted: no live AI, microphone or real booking.</span></div>
      <div className="rounded-[14px] p-4 min-h-[220px] flex flex-col gap-2" style={{ background: "var(--mk-bg)", border: "1px solid var(--mk-border)" }} aria-live="polite">
        {shown.length === 0 && <div className="text-[13.5px] m-auto" style={{ color: "var(--mk-muted)" }}>Pick something to say below.</div>}
        {shown.map((t, i) => (
          <div key={i} className={`max-w-[85%] rounded-[12px] px-3.5 py-2 text-[14px] ${t.from === "caller" ? "self-end" : "self-start"}`} style={{ background: t.from === "caller" ? "var(--mk-blue)" : "var(--mk-bg2)", border: t.from === "ai" ? "1px solid var(--mk-border)" : "none" }}>{t.text}</div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {script.map((s) => <button key={s.prompt} type="button" onClick={() => setShown(s.turns)} className="mk-btn mk-btn-ghost" style={{ height: 36, fontSize: 13 }}>{s.prompt}</button>)}
        {shown.length > 0 && <button type="button" onClick={() => setShown([])} className="text-[13px] px-2" style={{ color: "var(--mk-muted)" }}>Reset</button>}
      </div>
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
      <p className="text-[13px] mb-4" style={{ color: "var(--mk-muted)" }}>A transparent estimate from your own inputs. It is an assumption-based opportunity, never a guaranteed result.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{field("Calls per month", calls, setCalls)}{field("Missed calls", missed, setMissed, "%")}{field("Avg customer value", value, setValue, "$")}{field("Missed-call to job rate", conv, setConv, "%")}{field("Monthly software cost", cost, setCost, "$")}</div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="mk-card p-5"><div className="text-[12px] uppercase tracking-wide" style={{ color: "var(--mk-muted)" }}>Missed calls</div><div className="text-[28px] font-semibold mt-1">{f(missedCalls)}</div></div>
        <div className="mk-card p-5"><div className="text-[12px] uppercase tracking-wide" style={{ color: "var(--mk-muted)" }}>Possible extra jobs</div><div className="text-[28px] font-semibold mt-1">{jobs.toFixed(1)}</div></div>
        <div className="mk-card p-5"><div className="text-[12px] uppercase tracking-wide" style={{ color: "var(--mk-muted)" }}>Opportunity after software cost</div><div className="text-[28px] font-semibold mt-1">${f(net)}<span className="text-[13px] font-normal" style={{ color: "var(--mk-muted)" }}> /mo</span></div></div>
      </div>
      <p className="mt-4 text-[12.5px]" style={{ color: "var(--mk-muted)" }}>Formula: calls × missed % × job rate × customer value − software cost = ${f(calls)} × {missed}% × {conv}% × ${f(value)} − ${f(cost)}.</p>
    </div>
  );
}

const TABS = ["AI receptionist", "Website chatbot", "Website audit", "Missed-call text-back", "ROI calculator"] as const;
export default function DemoStage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("AI receptionist");
  return (
    <div className="mk-card p-5 md:p-8">
      <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Demo modules">
        {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)} className="mk-btn" style={{ height: 38, fontSize: 13.5, background: tab === t ? "var(--mk-blue)" : "transparent", border: "1px solid " + (tab === t ? "var(--mk-blue)" : "var(--mk-border)") }}>{t}</button>)}
      </div>
      {tab === "AI receptionist" && <Chat script={RECEPTIONIST} label="A caller talks to the receptionist" />}
      {tab === "Website chatbot" && <Chat script={CHATBOT} label="A visitor chats with the site assistant" />}
      {tab === "Website audit" && (
        <div>
          <div className="flex items-center gap-3 mb-4"><Sim /><span className="text-[13px]" style={{ color: "var(--mk-muted)" }}>Illustrative sample report for a made-up site. Real audits read the public site you enter and cite what they found.</span></div>
          <div className="rounded-[14px] overflow-hidden" style={{ border: "1px solid var(--mk-border)" }}>
            {AUDIT.map((a, i) => (
              <div key={a.check} className="grid grid-cols-[1fr_auto] md:grid-cols-[180px_120px_1fr] gap-x-4 gap-y-1 px-4 py-3 text-[14px]" style={{ borderTop: i ? "1px solid var(--mk-border)" : "none", background: i % 2 ? "var(--mk-bg)" : "transparent" }}>
                <span className="font-medium">{a.check}</span><span style={{ color: a.result === "Pass" ? "var(--mk-blue2)" : "var(--mk-muted)" }}>{a.result}</span><span className="col-span-2 md:col-span-1" style={{ color: "var(--mk-muted)" }}>{a.note}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === "Missed-call text-back" && (
        <div>
          <div className="flex items-center gap-3 mb-4"><Sim /><span className="text-[13px]" style={{ color: "var(--mk-muted)" }}>Simulated phone events. No real call or text is sent.</span></div>
          <ol className="flex flex-col gap-2">{MISSED.map((m, i) => (
            <li key={i} className="flex gap-3 items-start text-[14px]"><span className="w-[44px] shrink-0 text-[12px] pt-1" style={{ color: "var(--mk-muted)" }}>{m.t}</span>
              <span className="rounded-[10px] px-3 py-1.5" style={{ background: m.who === "cust" ? "var(--mk-blue)" : "var(--mk-bg)", border: m.who === "cust" ? "none" : "1px solid var(--mk-border)", color: m.who === "sys" ? "var(--mk-muted)" : "var(--mk-text)" }}>{m.text}</span></li>))}</ol>
        </div>
      )}
      {tab === "ROI calculator" && <Roi />}
    </div>
  );
}
