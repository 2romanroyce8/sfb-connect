"use client";

import { useState } from "react";
import { Loader2, Check, Copy, ExternalLink } from "lucide-react";

type Suggestion = { startISO: string; endISO: string; label: string };

const DURATIONS = [15, 30, 45, 60];

export default function MeetingBookingFlow({
  leadId,
  callId,
  defaultPhone,
  onBooked,
  onCancel,
}: {
  leadId: string;
  callId?: string;
  defaultPhone?: string | null;
  onBooked: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<"form" | "conflict" | "confirmed">("form");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState(defaultPhone || "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(30);
  const [timeZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ code?: string; message: string } | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [chosenSlot, setChosenSlot] = useState<{ startISO: string; endISO: string } | null>(null);
  const [result, setResult] = useState<{ meetUrl: string | null; htmlLink: string; confirmationMessage: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function checkAvailability() {
    if (!date || !time) {
      setError({ message: "Pick a date and time first." });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/leads/${leadId}/meetings/check-availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, time, durationMinutes: duration, timeZone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError({ code: data.error, message: data.message || data.error || "Could not check availability." });
        return;
      }
      if (data.available) {
        setChosenSlot({ startISO: data.startISO, endISO: data.endISO });
        await book(data.startISO, data.endISO);
      } else {
        setSuggestions(data.suggestions || []);
        setStep("conflict");
      }
    } catch {
      setError({ message: "Network error checking availability." });
    } finally {
      setLoading(false);
    }
  }

  async function book(startISO: string, endISO: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/leads/${leadId}/meetings/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactName, contactEmail, contactPhone, startISO, endISO, timeZone, callId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError({ code: data.error, message: data.message || data.error || "Could not book the meeting." });
        setStep("form");
        return;
      }
      setResult({ meetUrl: data.meetUrl, htmlLink: data.htmlLink, confirmationMessage: data.confirmationMessage });
      setStep("confirmed");
    } catch {
      setError({ message: "Network error booking the meeting." });
      setStep("form");
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  if (step === "confirmed" && result) {
    return (
      <div>
        <div className="text-[15px] font-semibold text-[#30D158] mb-3">Meeting Booked</div>
        <div className="rounded-[10px] p-3 mb-3 text-[13px] text-[#F5F5F7]" style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)" }}>
          {contactName && <div>{contactName}</div>}
          {chosenSlot && (
            <div className="text-[#A1A1A6] mt-0.5">
              {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone }).format(new Date(chosenSlot.startISO))} ·{" "}
              {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone }).format(new Date(chosenSlot.startISO))}
            </div>
          )}
          {result.meetUrl ? (
            <a href={result.meetUrl} target="_blank" rel="noopener noreferrer" className="text-[#0A84FF] mt-1 inline-block">
              Open Meeting →
            </a>
          ) : (
            <div className="text-[#FFD60A] mt-1">Event created, but Google didn't return a Meet link — add one manually in Calendar.</div>
          )}
        </div>
        <div className="rounded-[10px] p-3 mb-4 text-[12.5px] text-[#A1A1A6] whitespace-pre-line" style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)" }}>
          {result.confirmationMessage}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => copy(result.confirmationMessage, "message")} className="h-[34px] px-3 rounded-[8px] text-[12px] text-[#A1A1A6] hover:text-white flex items-center gap-1.5" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            <Copy size={12} /> {copied === "message" ? "Copied" : "Copy Message"}
          </button>
          {result.meetUrl && (
            <button onClick={() => copy(result.meetUrl!, "link")} className="h-[34px] px-3 rounded-[8px] text-[12px] text-[#A1A1A6] hover:text-white flex items-center gap-1.5" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
              <Copy size={12} /> {copied === "link" ? "Copied" : "Copy Meet Link"}
            </button>
          )}
          <a href={result.htmlLink} target="_blank" rel="noopener noreferrer" className="h-[34px] px-3 rounded-[8px] text-[12px] text-[#A1A1A6] hover:text-white flex items-center gap-1.5" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            <ExternalLink size={12} /> Open Calendar
          </a>
          <button onClick={onBooked} className="h-[34px] px-4 rounded-[8px] bg-white text-black text-[12.5px] font-semibold flex items-center gap-1.5">
            <Check size={13} /> Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-[13.5px] font-semibold text-[#F5F5F7] mb-3">Book Meeting</div>

      {error && (
        <div className="mb-3 text-[12.5px] text-[#FF453A] rounded-[8px] p-2.5" style={{ background: "rgba(255,69,58,0.08)" }}>
          {error.message}
          {(error.code === "google_not_connected" || error.code === "google_auth_expired") && (
            <a href="/team/integrations" className="block text-[#0A84FF] mt-1">
              Go to Integrations →
            </a>
          )}
        </div>
      )}

      {step === "conflict" ? (
        <div className="mb-3">
          <div className="text-[12.5px] text-[#FFD60A] mb-2">You're busy at this time.</div>
          {suggestions.length === 0 ? (
            <div className="text-[12px] text-[#6E6E73]">No open slots found that day — try a different date.</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s.startISO}
                  onClick={() => book(s.startISO, s.endISO)}
                  disabled={loading}
                  className="h-[36px] rounded-[8px] text-[13px] text-[#F5F5F7]"
                  style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setStep("form")} className="text-[12px] text-[#6E6E73] hover:text-white mt-2">
            ← Pick a different time
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 mb-3">
          <input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Contact name"
            className="h-[36px] rounded-[8px] px-3 text-[13px] outline-none"
            style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="Email"
              className="h-[36px] rounded-[8px] px-3 text-[13px] outline-none"
              style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
            />
            <input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="Phone"
              className="h-[36px] rounded-[8px] px-3 text-[13px] outline-none"
              style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-[36px] rounded-[8px] px-2 text-[12.5px] outline-none"
              style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-[36px] rounded-[8px] px-2 text-[12.5px] outline-none"
              style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
            />
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="h-[36px] rounded-[8px] px-2 text-[12.5px] outline-none"
              style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </select>
          </div>
          <div className="text-[11px] text-[#6E6E73]">Timezone: {timeZone}</div>
        </div>
      )}

      {step === "form" && (
        <div className="flex gap-2">
          <button
            onClick={checkAvailability}
            disabled={loading}
            className="h-[38px] px-4 rounded-[8px] bg-white text-black text-[13px] font-semibold disabled:opacity-60 flex items-center gap-1.5"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null} {loading ? "Checking…" : "Check Availability"}
          </button>
          <button onClick={onCancel} className="h-[38px] px-4 rounded-[8px] text-[13px] text-[#A1A1A6]" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
