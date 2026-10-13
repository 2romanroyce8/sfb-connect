"use client";

import { useEffect, useState } from "react";
import { trackMarketingEvent } from "@/lib/marketingEvents";
import { SUPPORT_EMAIL, callbackHint, HOURS_LABEL } from "@/lib/site";

// "Book a demo call" — trigger + modal. Slots come from the live calendar
// (all Eastern, labeled every time). On confirm: the event is on Rome's
// calendar with a Meet link, Google invites the prospect, we show add-to-
// calendar links, the "save our number" card, and — if they're free right
// now — the team is alerted instantly and the copy states what happens next
// (Roman's callback hours, lib/site.ts) — never a guarantee.
type Slot = { start: string; end: string }; type Day = { date: string; label: string; slots: Slot[] };
type Booked = { call: { id: string; start_at: string; end_at: string; meet_url: string | null; when: string; call_now: boolean }; links: { google: string; outlook: string; ics: string; vcard: string }; promise: string | null };
const field: React.CSSProperties = { background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.12)", color: "#F5F5F7" };
const PHONE = "213-523-1641";
const timeET = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });

/** Reported to `onClose` on every dismiss (X, backdrop, Esc, Done): whether a booking was completed in this session, and its id. */
export type BookDemoCallClose = { booked: boolean; callId: string | null };

export default function BookDemoCall({ source, compact = false, prefill, onClose }: { source: string; compact?: boolean; prefill?: { name?: string | null; email?: string | null; phone?: string | null; website?: string | null }; onClose?: (r: BookDemoCallClose) => void }) {
  const [open, setOpen] = useState(false);
  const trigger = compact
    ? <button type="button" onClick={() => { setOpen(true); trackMarketingEvent("demo_call_open", { source }); }} className="underline underline-offset-4 text-white/[0.85] hover:text-white">Book a demo call</button>
    : <button type="button" onClick={() => { setOpen(true); trackMarketingEvent("demo_call_open", { source }); }} className="inline-flex items-center px-6 py-3.5 rounded-full text-[14px] font-medium text-white hover:bg-white/[0.08] transition-colors" style={{ border: "1px solid rgba(255,255,255,0.28)", background: "rgba(7,7,7,0.4)" }}>Book a demo call</button>;
  return <>{trigger}{open && <Modal source={source} prefill={prefill} onClose={(r) => { setOpen(false); onClose?.(r); }} />}</>;
}

function Modal({ source, prefill, onClose: close }: { source: string; prefill?: { name?: string | null; email?: string | null; phone?: string | null; website?: string | null }; onClose: (r: BookDemoCallClose) => void }) {
  const [days, setDays] = useState<Day[] | null>(null); const [calendarConnected, setCalendarConnected] = useState(true);
  const [day, setDay] = useState<string | null>(null); const [slot, setSlot] = useState<Slot | null>(null);
  const [f, setF] = useState({ name: prefill?.name ?? "", email: prefill?.email ?? "", phone: prefill?.phone ?? "", website: prefill?.website ?? "", callNow: false });
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [booked, setBooked] = useState<Booked | null>(null);
  // Every dismiss path reports whether a booking was completed, so a host (onboarding step 9) can advance only when it was.
  const onClose = () => close({ booked: !!booked, callId: booked?.call.id ?? null });
  useEffect(() => { (async () => { try { const r = await fetch("/api/demo-call/slots", { cache: "no-store" }); const j = (await r.json()) as { days: Day[]; calendarConnected: boolean }; setDays(j.days); setCalendarConnected(j.calendarConnected); setDay(j.days[0]?.date ?? null); } catch { setDays([]); setCalendarConnected(false); } })(); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") close({ booked: !!booked, callId: booked?.call.id ?? null }); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [close, booked]);
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  const book = async (e: React.FormEvent) => {
    e.preventDefault(); if (!slot) { setError("Pick a time first."); return; } setBusy(true); setError(null);
    try {
      const r = await fetch("/api/demo-call/book", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, start: slot.start, source }) });
      const j = (await r.json()) as Booked & { error?: string; code?: string };
      if (!r.ok) { setError(j.error || "Booking failed."); if (j.code === "slot_taken") { setSlot(null); const rr = await fetch("/api/demo-call/slots", { cache: "no-store" }); const jj = (await rr.json()) as { days: Day[] }; setDays(jj.days); } return; }
      trackMarketingEvent("demo_call_booked", { source, call_now: f.callNow }); setBooked(j);
    } catch (err) { setError(err instanceof Error ? err.message : "Booking failed."); } finally { setBusy(false); }
  };
  const current = days?.find((d) => d.date === day) ?? null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6" role="dialog" aria-modal="true" aria-label="Book a demo call">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full sm:max-w-[640px] max-h-[92vh] overflow-y-auto rounded-t-[18px] sm:rounded-[18px] p-6 md:p-8 text-white" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.1)" }}>
        <button type="button" onClick={onClose} className="absolute right-4 top-4 text-white/[0.5] hover:text-white text-[13px]">Close</button>
        {!booked ? (
          <form onSubmit={book} className="flex flex-col gap-4">
            <div><div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#30D158]">Book a demo call</div><h2 className="text-[24px] font-bold tracking-[-0.03em] mt-1">Pick a time. <span className="text-white/[0.5] font-normal text-[16px]">All times Eastern (ET).</span></h2><div className="text-[12.5px] text-white/[0.5] mt-1.5">Hours: {HOURS_LABEL}.</div></div>
            {days === null ? <div className="text-[13px] text-white/[0.5]">Loading open times…</div> : !calendarConnected ? <div className="text-[13px] text-[#FF9F9A]">Our calendar isn&apos;t reachable right now. Email {SUPPORT_EMAIL} and we&apos;ll set a time by hand.</div> : days.length === 0 ? <div className="text-[13px] text-white/[0.5]">No open times in the next 10 days — email {SUPPORT_EMAIL}.</div> : (
              <>
                <div className="flex gap-2 overflow-x-auto pb-1">{days.map((d) => <button key={d.date} type="button" onClick={() => { setDay(d.date); setSlot(null); }} className="shrink-0 h-[36px] px-3 rounded-full text-[12.5px]" style={{ border: `1px solid ${day === d.date ? "#30D158" : "rgba(255,255,255,0.14)"}`, color: day === d.date ? "#30D158" : "rgba(255,255,255,0.8)" }}>{d.label}</button>)}</div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">{current?.slots.map((s) => <button key={s.start} type="button" onClick={() => setSlot(s)} className="h-[38px] rounded-[9px] text-[13px]" style={{ background: slot?.start === s.start ? "#30D158" : "#0F0F0F", color: slot?.start === s.start ? "#000" : "#F5F5F7", border: "1px solid rgba(255,255,255,0.12)" }}>{timeET(s.start)} <span className="opacity-60 text-[10px]">ET</span></button>)}</div>
              </>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              <input required minLength={2} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Your name" autoComplete="name" className="h-[44px] rounded-[9px] px-3 text-[14px] outline-none" style={field} />
              <input required type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="Email (invite goes here)" autoComplete="email" className="h-[44px] rounded-[9px] px-3 text-[14px] outline-none" style={field} />
              <input required value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Phone we should call" inputMode="tel" autoComplete="tel" className="h-[44px] rounded-[9px] px-3 text-[14px] outline-none" style={field} />
              <input value={f.website} onChange={(e) => set("website", e.target.value)} placeholder="Business website (optional)" inputMode="url" className="h-[44px] rounded-[9px] px-3 text-[14px] outline-none" style={field} />
            </div>
            <label className="flex items-start gap-2.5 rounded-[10px] p-3 cursor-pointer" style={{ background: f.callNow ? "rgba(48,209,88,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${f.callNow ? "rgba(48,209,88,0.4)" : "rgba(255,255,255,0.1)"}` }}>
              <input type="checkbox" checked={f.callNow} onChange={(e) => set("callNow", e.target.checked)} className="mt-1" />
              <span className="text-[13px]"><span className="font-semibold text-white">Free for a call right now?</span><span className="text-white/[0.55]"> {callbackHint()}</span></span>
            </label>
            {error && <div className="text-[12.5px] text-[#FF9F9A]">{error}</div>}
            <button type="submit" disabled={busy || !slot} className="h-[48px] rounded-full bg-white text-black text-[15px] font-semibold disabled:opacity-50">{busy ? "Booking…" : slot ? `Confirm ${timeET(slot.start)} ET →` : "Pick a time to continue"}</button>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <div><div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#30D158]">Booked</div><h2 className="text-[24px] font-bold tracking-[-0.03em] mt-1">{booked.call.when}</h2></div>
            {booked.promise && <div className="rounded-[12px] p-4 text-[14px]" style={{ background: "rgba(48,209,88,0.1)", border: "1px solid rgba(48,209,88,0.4)" }}><strong>{booked.promise}</strong> Keep your phone close.</div>}
            <div className="text-[13px] text-white/[0.6]">The invite is on its way to {f.email}. {booked.call.meet_url && <>Join link: <a href={booked.call.meet_url} target="_blank" rel="noopener noreferrer" className="underline text-white">{booked.call.meet_url}</a></>}</div>
            <div><div className="text-[11px] uppercase tracking-[0.14em] text-white/[0.45] font-semibold mb-2">Add to your calendar</div><div className="flex flex-wrap gap-2">
              <a href={booked.links.google} target="_blank" rel="noopener noreferrer" className="h-[38px] px-4 rounded-full text-[13px] inline-flex items-center" style={{ border: "1px solid rgba(255,255,255,0.16)" }}>Google</a>
              <a href={booked.links.ics} className="h-[38px] px-4 rounded-full text-[13px] inline-flex items-center" style={{ border: "1px solid rgba(255,255,255,0.16)" }}>Apple (.ics)</a>
              <a href={booked.links.outlook} target="_blank" rel="noopener noreferrer" className="h-[38px] px-4 rounded-full text-[13px] inline-flex items-center" style={{ border: "1px solid rgba(255,255,255,0.16)" }}>Outlook</a>
            </div></div>
            <div className="rounded-[14px] p-4" style={{ background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.12)" }}>
              <div className="text-[15px] font-semibold">Save <span className="text-[#30D158]">{PHONE}</span> as <span className="text-[#30D158]">SFB CONNECT</span></div>
              <div className="text-[13px] text-white/[0.55] mt-1">So you know it&apos;s us when we call.</div>
              <div className="mt-3 flex flex-wrap gap-2"><a href={booked.links.vcard} className="h-[38px] px-4 rounded-full text-[13px] font-semibold bg-white text-black inline-flex items-center">Save contact</a><a href={`tel:+1${PHONE.replace(/-/g, "")}`} className="h-[38px] px-4 rounded-full text-[13px] inline-flex items-center" style={{ border: "1px solid rgba(255,255,255,0.16)" }}>{PHONE}</a></div>
            </div>
            <button type="button" onClick={onClose} className="self-start text-[13px] text-white/[0.6] underline">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
