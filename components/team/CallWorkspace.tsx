"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, PhoneOff, Loader2 } from "lucide-react";
import MeetingBookingFlow from "./MeetingBookingFlow";

type Lead = {
  id: string;
  business_name: string | null;
  website: string | null;
  phone: string | null;
  category: string | null;
  city: string | null;
  state: string | null;
};

type Category = { category: string; score: number; negative_evidence: string[]; positive_evidence: string[] };
type Opportunity = { primary_offer: string; confidence: string } | null;
type Script = { opening: string; hook: string; observation: string; why_it_matters: string; solution: string; discovery_question: string; transition: string; booking_ask: string; close: string } | null;
type ActiveCall = { id: string; started_at: string } | null;

const OFFER_LABEL: Record<string, string> = {
  ai_presence: "AI Presence",
  website_new: "New Website",
  website_rebuild: "Website Rebuild",
  bingled: "Bingled",
  no_clear_opportunity: "No Clear Opportunity",
};

const OUTCOMES: { value: string; label: string; color: string }[] = [
  { value: "booked_meeting", label: "Booked Meeting", color: "#30D158" },
  { value: "interested", label: "Interested", color: "#30D158" },
  { value: "call_back_later", label: "Call Back Later", color: "#FFD60A" },
  { value: "no_answer", label: "No Answer", color: "#6E6E73" },
  { value: "voicemail", label: "Voicemail", color: "#6E6E73" },
  { value: "not_interested", label: "Not Interested", color: "#FF453A" },
  { value: "wrong_number", label: "Wrong Number", color: "#FF9F0A" },
  { value: "hung_up", label: "Hung Up", color: "#FF453A" },
  { value: "bad_lead", label: "Bad Lead", color: "#FF453A" },
  { value: "sale_closed", label: "Sale Closed", color: "#30D158" },
  { value: "other", label: "Other", color: "#6E6E73" },
];

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function CallWorkspace({
  lead,
  categories,
  opportunity,
  script,
  activeCall,
  existingNotes,
}: {
  lead: Lead;
  categories: Category[];
  opportunity: Opportunity;
  script: Script;
  activeCall: ActiveCall;
  existingNotes: string;
}) {
  const router = useRouter();
  const [call, setCall] = useState(activeCall);
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState(existingNotes);
  const [starting, setStarting] = useState(false);
  const [showOutcome, setShowOutcome] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [followupAt, setFollowupAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!call) return;
    const tick = () => setElapsed(Math.floor((Date.now() - new Date(call.started_at).getTime()) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [call]);

  function scheduleNoteSave(value: string) {
    if (!call) return;
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => {
      fetch(`/api/team/calls/${call.id}/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: value }),
      }).catch(() => {});
    }, 700);
  }

  async function startCall() {
    setStarting(true);
    try {
      const res = await fetch(`/api/team/leads/${lead.id}/calls`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCall(data);
      if (lead.phone) window.location.href = `tel:${lead.phone.replace(/[^\d+]/g, "")}`;
    } catch {
      // leave the button available to retry
    } finally {
      setStarting(false);
    }
  }

  async function submitOutcome() {
    if (!call || !outcome) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { outcome, outcomeReason: reason || undefined };
      if (outcome === "call_back_later" || outcome === "interested" || outcome === "no_answer" || outcome === "voicemail") {
        if (followupAt) payload.followup = { dueAt: new Date(followupAt).toISOString(), reason };
      }
      const res = await fetch(`/api/team/calls/${call.id}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setCall(null);
      setShowOutcome(false);
      setOutcome(null);
      router.refresh();
    } catch {
      // keep the sheet open so the rep can retry
    } finally {
      setSubmitting(false);
    }
  }

  const struggles = categories.flatMap((c) => c.negative_evidence).slice(0, 4);
  const strengths = categories.flatMap((c) => c.positive_evidence).slice(0, 3);
  const weakestCategory = [...categories].sort((a, b) => a.score - b.score)[0];

  return (
    <div className="px-8 py-6">
      <div className="flex items-center justify-between mb-6 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div>
          <div className="text-[18px] font-semibold text-[#F5F5F7]">{lead.business_name || "Unnamed lead"}</div>
          <div className="text-[13px] text-[#A1A1A6] mt-0.5">{lead.phone || "No phone on file"}</div>
        </div>
        <div className="flex items-center gap-6">
          {opportunity && (
            <div className="text-right">
              <div className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">Recommended Offer</div>
              <div className="text-[13.5px] text-[#F5F5F7]">{OFFER_LABEL[opportunity.primary_offer]}</div>
            </div>
          )}
          <div className="text-right">
            <div className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">Verification</div>
            <div className="text-[13.5px] text-[#F5F5F7]">{lead.phone ? "Phone on file" : "Unverified"}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[240px_1fr_300px] gap-6">
        {/* LEFT: business intelligence */}
        <div className="flex flex-col gap-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73]">Business Intelligence</div>
          <Info label="Contact" value={lead.phone || "Not found"} />
          <Info label="Category" value={lead.category || "Unknown"} />
          <Info label="Location" value={[lead.city, lead.state].filter(Boolean).join(", ") || "Unknown"} />
          {weakestCategory && <Info label="Key Weakness" value={weakestCategory.category.replace(/_/g, " ")} />}
          {strengths.length > 0 && (
            <div>
              <div className="text-[10.5px] uppercase tracking-wide text-[#30D158] mb-1">Strongest Point</div>
              <div className="text-[12px] text-[#A1A1A6]">{strengths[0]}</div>
            </div>
          )}
          {struggles.length > 0 && (
            <div>
              <div className="text-[10.5px] uppercase tracking-wide text-[#FFD60A] mb-1">Talking Points</div>
              {struggles.map((s, i) => (
                <div key={i} className="text-[12px] text-[#A1A1A6] mb-1">• {s}</div>
              ))}
            </div>
          )}
        </div>

        {/* CENTER: script */}
        <div className="rounded-[14px] p-6 flex flex-col gap-4 max-h-[70vh] overflow-y-auto" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          {!script ? (
            <div className="text-[13px] text-[#6E6E73]">No script generated yet for this lead.</div>
          ) : (
            (
              [
                ["Opening", script.opening],
                ["Hook", script.hook],
                ["Observation", script.observation],
                ["Why It Matters", script.why_it_matters],
                ["Discovery Question", script.discovery_question],
                ["Offer", script.solution],
                ["Transition", script.transition],
                ["Meeting Close", script.booking_ask],
                ["Final Close", script.close],
              ] as [string, string][]
            ).map(([label, text]) => (
              <div key={label}>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[#6E6E73] mb-1">{label}</div>
                <p className="text-[14px] text-[#F5F5F7] leading-relaxed">{text}</p>
              </div>
            ))
          )}
        </div>

        {/* RIGHT: call controls */}
        <div className="flex flex-col gap-4">
          {!call ? (
            <button
              onClick={startCall}
              disabled={starting}
              className="h-[46px] rounded-[10px] bg-white text-black text-[14px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {starting ? <Loader2 size={16} className="animate-spin" /> : <Phone size={16} />} Call
            </button>
          ) : (
            <>
              <div className="rounded-[10px] p-4 text-center" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="text-[28px] font-mono font-semibold text-[#F5F5F7]">{formatDuration(elapsed)}</div>
                <div className="text-[10.5px] uppercase tracking-wide text-[#6E6E73] mt-1">Device Call in progress</div>
              </div>
              <button
                onClick={() => setShowOutcome(true)}
                className="h-[42px] rounded-[9px] text-[13.5px] font-semibold flex items-center justify-center gap-2"
                style={{ background: "#FF453A", color: "white" }}
              >
                <PhoneOff size={15} /> End Call
              </button>
            </>
          )}

          <div className="rounded-[12px] p-3 flex-1" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-[10.5px] uppercase tracking-wide text-[#6E6E73] mb-2">Notes</div>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                scheduleNoteSave(e.target.value);
              }}
              disabled={!call}
              placeholder={call ? "Type notes during the call — autosaves" : "Start a call to take notes"}
              className="w-full h-[220px] resize-none rounded-[8px] p-2.5 text-[12.5px] outline-none disabled:opacity-50"
              style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
            />
          </div>
        </div>
      </div>

      {showOutcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-[420px] rounded-[14px] p-6" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="text-[16px] font-semibold text-[#F5F5F7] mb-4">What happened?</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {OUTCOMES.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setOutcome(o.value)}
                  className="h-[38px] rounded-[8px] text-[12.5px] text-left px-3"
                  style={{
                    background: outcome === o.value ? "#151515" : "transparent",
                    border: `1px solid ${outcome === o.value ? o.color : "rgba(255,255,255,0.08)"}`,
                    color: outcome === o.value ? "#F5F5F7" : "#A1A1A6",
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {(outcome === "not_interested" || outcome === "bad_lead" || outcome === "other") && (
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional)"
                className="w-full h-[38px] rounded-[8px] px-3 text-[13px] outline-none mb-3"
                style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
              />
            )}

            {(outcome === "call_back_later" || outcome === "interested" || outcome === "no_answer" || outcome === "voicemail") && (
              <div className="mb-3">
                <label className="text-[11px] text-[#6E6E73] uppercase tracking-wide">Follow up on</label>
                <input
                  type="datetime-local"
                  value={followupAt}
                  onChange={(e) => setFollowupAt(e.target.value)}
                  className="w-full h-[38px] rounded-[8px] px-3 text-[13px] outline-none mt-1"
                  style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
                />
              </div>
            )}

            {outcome === "booked_meeting" && call && (
              <MeetingBookingFlow
                leadId={lead.id}
                callId={call.id}
                defaultPhone={lead.phone}
                onCancel={() => setOutcome(null)}
                onBooked={() => {
                  setShowOutcome(false);
                  setOutcome(null);
                  setCall(null);
                  router.refresh();
                }}
              />
            )}

            {outcome !== "booked_meeting" && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={submitOutcome}
                  disabled={!outcome || submitting}
                  className="h-[38px] px-4 rounded-[8px] bg-white text-black text-[13px] font-semibold disabled:opacity-50"
                >
                  {submitting ? "Saving…" : "Save Outcome"}
                </button>
                <button
                  onClick={() => setShowOutcome(false)}
                  className="h-[38px] px-4 rounded-[8px] text-[13px] text-[#A1A1A6]"
                  style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">{label}</div>
      <div className="text-[13px] text-[#F5F5F7] capitalize">{value}</div>
    </div>
  );
}
