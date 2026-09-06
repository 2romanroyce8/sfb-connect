"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Clock3,
  Sparkles,
  CalendarClock,
  Check,
  ExternalLink,
  Phone,
  Video,
  Mail,
  ClipboardList,
  FileSearch,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

type Followup = {
  id: string;
  lead_id: string;
  rep_id: string;
  due_at: string;
  reason: string | null;
  notes: string | null;
  status: string;
  followup_type: "CALL" | "MEETING" | "EMAIL" | "TASK" | "RESEARCH";
  title: string | null;
  timezone: string;
  related_call_id: string | null;
  related_meeting_id: string | null;
  related_research_result_id: string | null;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
};
type Lead = { id: string; business_name: string | null; phone: string | null; email: string | null; category: string | null; owner_name: string | null };
type CallCtx = { id: string; outcome: string | null; outcome_reason: string | null; notes: string | null; ended_at: string | null };
type Meeting = { id: string; scheduled_at: string; google_meet_url: string | null; contact_name: string | null; status: string };

const TABS = ["OVERDUE", "TODAY", "UPCOMING", "COMPLETED"] as const;
type Tab = (typeof TABS)[number];

const TYPE_ICON: Record<Followup["followup_type"], React.ElementType> = {
  CALL: Phone,
  MEETING: Video,
  EMAIL: Mail,
  TASK: ClipboardList,
  RESEARCH: FileSearch,
};

const OBJECTION_OUTCOMES = new Set(["not_interested", "bad_lead", "wrong_number"]);

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function formatUrgency(dueAt: string): { text: string; color: string } {
  const now = new Date();
  const due = new Date(dueAt);
  const diffMs = due.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMs < 0) {
    const overdueMin = Math.abs(diffMin);
    if (overdueMin < 60) return { text: `overdue by ${overdueMin} minute${overdueMin === 1 ? "" : "s"}`, color: "#FF453A" };
    const overdueHr = Math.round(overdueMin / 60);
    if (overdueHr < 24) return { text: `overdue by ${overdueHr} hour${overdueHr === 1 ? "" : "s"}`, color: "#FF453A" };
    return { text: `overdue since ${due.toLocaleDateString()}`, color: "#FF453A" };
  }
  if (diffMin < 60) return { text: `in ${diffMin} minute${diffMin === 1 ? "" : "s"}`, color: "#FFD60A" };
  if (isSameDay(due, now)) return { text: `today at ${due.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`, color: "#FFD60A" };
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return { text: `in ${diffHr} hour${diffHr === 1 ? "" : "s"}`, color: "#A1A1A6" };
  return { text: `${due.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} at ${due.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`, color: "#A1A1A6" };
}

export default function FollowUpStack({
  followups: initialFollowups,
  leadMap,
  callMap,
  mostRecentCallByLead,
  meetingMap,
  repMap,
  isOwner,
  currentUserId,
  allReps,
}: {
  followups: Followup[];
  leadMap: Record<string, Lead>;
  callMap: Record<string, CallCtx>;
  mostRecentCallByLead: Record<string, CallCtx>;
  meetingMap: Record<string, Meeting>;
  repMap: Record<string, string>;
  isOwner: boolean;
  currentUserId: string;
  allReps: { id: string; label: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusId = searchParams?.get("focus") || null;
  const [followups, setFollowups] = useState(initialFollowups);
  // router.refresh() re-runs the server component and passes a new
  // initialFollowups array, but a useState initial value only applies on
  // first mount -- without this, a router.refresh() (after quick-create,
  // for example) would silently not reach the screen.
  useEffect(() => {
    setFollowups(initialFollowups);
  }, [initialFollowups]);
  const [tab, setTab] = useState<Tab>("TODAY");
  const [cardIndex, setCardIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [reschedulePanel, setReschedulePanel] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const now = new Date();
  const buckets = useMemo(() => {
    const open = followups.filter((f) => f.status === "open");
    return {
      OVERDUE: open.filter((f) => new Date(f.due_at) < now),
      TODAY: open.filter((f) => new Date(f.due_at) >= now && isSameDay(new Date(f.due_at), now)),
      UPCOMING: open.filter((f) => new Date(f.due_at) > now && !isSameDay(new Date(f.due_at), now)),
      COMPLETED: followups.filter((f) => f.status === "completed").sort((a, b) => new Date(b.completed_at || b.due_at).getTime() - new Date(a.completed_at || a.due_at).getTime()),
    };
  }, [followups, now]);

  useEffect(() => {
    if (!focusId) return;
    for (const t of TABS) {
      const idx = buckets[t].findIndex((f) => f.id === focusId);
      if (idx !== -1) {
        setTab(t);
        setCardIndex(idx);
        break;
      }
    }
    // Only run once on mount/focusId change — after that the rep drives
    // navigation manually.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  const cards = buckets[tab];
  const current = cards[Math.min(cardIndex, cards.length - 1)] || null;

  function switchTab(t: Tab) {
    setTab(t);
    setCardIndex(0);
    setReschedulePanel(false);
    setDetailsOpen(false);
  }

  async function complete(f: Followup) {
    setBusy(true);
    try {
      await fetch(`/api/team/followups/${f.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "completed" }) });
      setFollowups((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: "completed", completed_at: new Date().toISOString() } : x)));
    } finally {
      setBusy(false);
    }
  }

  async function reschedule(f: Followup) {
    if (!newDate) return;
    setBusy(true);
    try {
      const iso = new Date(newDate).toISOString();
      await fetch(`/api/team/followups/${f.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dueAt: iso }) });
      setFollowups((prev) => prev.map((x) => (x.id === f.id ? { ...x, due_at: iso } : x)));
      setReschedulePanel(false);
      setNewDate("");
    } finally {
      setBusy(false);
    }
  }

  if (followups.length === 0) {
    return (
      <div className="px-8 py-8">
        <div className="rounded-[14px] p-10 text-center max-w-[480px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[15px] font-medium text-[#F5F5F7] mb-1.5">No follow-ups yet</div>
          <p className="text-[13px] text-[#A1A1A6] mb-4">Follow-ups created from a call outcome will show up here, or create one directly.</p>
          <button onClick={() => setShowCreate(true)} className="h-[36px] px-4 rounded-[8px] bg-white text-black text-[12.5px] font-semibold">
            New Follow-Up
          </button>
        </div>
        {showCreate && <QuickCreateModal onClose={() => setShowCreate(false)} onCreated={() => router.refresh()} isOwner={isOwner} allReps={allReps} />}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0B0B0B", color: "#F5F5F7", padding: "48px 32px 72px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6E6E73] mb-1">Workspace</div>
            <div style={{ fontSize: 32 }} className="font-semibold">
              Follow-Ups
            </div>
            <div style={{ fontSize: 14, color: "#8E8E93" }} className="mt-1">
              Your next conversations, reminders and required actions.
            </div>
          </div>
          <button onClick={() => setShowCreate(true)} className="h-[38px] px-4 rounded-[8px] bg-white text-black text-[13px] font-semibold self-start">
            New Follow-Up
          </button>
        </div>

        <div className="inline-flex self-start" style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: 4, gap: 4 }}>
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              style={{
                height: 34,
                padding: "0 14px",
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 7,
                background: tab === t ? "#F2F2F2" : "transparent",
                color: tab === t ? "#111111" : "#777777",
              }}
            >
              {t} {buckets[t].length > 0 && <span className="opacity-60">({buckets[t].length})</span>}
            </button>
          ))}
        </div>

        {cards.length === 0 ? (
          <div className="rounded-[24px] p-14 text-center" style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-[15px] text-[#A1A1A6]">Nothing here right now.</div>
          </div>
        ) : (
          <div style={{ position: "relative", width: "100%", maxWidth: 860, margin: "20px auto 0", minHeight: 640 }}>
            {cards.length > 2 && (
              <div
                style={{ position: "absolute", top: -42, left: 78, width: "calc(100% - 156px)", height: 540, background: "#111111", border: "1px solid rgba(255,255,255,0.035)", borderRadius: 34, opacity: 0.38, zIndex: 1 }}
              />
            )}
            {cards.length > 1 && (
              <div
                style={{ position: "absolute", top: -20, left: 38, width: "calc(100% - 76px)", height: 570, background: "#141414", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 34, opacity: 0.62, zIndex: 2 }}
              />
            )}

            {current && (
              <FollowUpCard
                followup={current}
                lead={leadMap[current.lead_id]}
                call={current.related_call_id ? callMap[current.related_call_id] : mostRecentCallByLead[current.lead_id]}
                meeting={current.related_meeting_id ? meetingMap[current.related_meeting_id] : undefined}
                assignedRepLabel={isOwner ? repMap[current.rep_id] || "Unassigned" : "You"}
                createdByLabel={current.created_by ? (current.created_by === currentUserId ? "You" : repMap[current.created_by] || "Teammate") : "—"}
                busy={busy}
                reschedulePanel={reschedulePanel}
                newDate={newDate}
                setNewDate={setNewDate}
                onToggleReschedule={() => setReschedulePanel((v) => !v)}
                onReschedule={() => reschedule(current)}
                onComplete={() => complete(current)}
                onOpenDetails={() => setDetailsOpen(true)}
                readOnly={tab === "COMPLETED"}
              />
            )}

            {cards.length > 1 && (
              <div className="flex items-center justify-center gap-4 mt-5">
                <button disabled={cardIndex === 0} onClick={() => setCardIndex((i) => Math.max(0, i - 1))} className="p-2 rounded-full disabled:opacity-30" style={{ background: "#141414" }}>
                  <ChevronLeft size={16} color="#A1A1A6" />
                </button>
                <span className="text-[12px] text-[#6E6E73]">
                  {cardIndex + 1} of {cards.length}
                </span>
                <button disabled={cardIndex >= cards.length - 1} onClick={() => setCardIndex((i) => Math.min(cards.length - 1, i + 1))} className="p-2 rounded-full disabled:opacity-30" style={{ background: "#141414" }}>
                  <ChevronRight size={16} color="#A1A1A6" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {detailsOpen && current && (
        <DetailsDrawer
          followup={current}
          lead={leadMap[current.lead_id]}
          call={current.related_call_id ? callMap[current.related_call_id] : mostRecentCallByLead[current.lead_id]}
          meeting={current.related_meeting_id ? meetingMap[current.related_meeting_id] : undefined}
          assignedRepLabel={isOwner ? repMap[current.rep_id] || "Unassigned" : "You"}
          createdByLabel={current.created_by ? (current.created_by === currentUserId ? "You" : repMap[current.created_by] || "Teammate") : "—"}
          onClose={() => setDetailsOpen(false)}
        />
      )}

      {showCreate && <QuickCreateModal onClose={() => setShowCreate(false)} onCreated={() => router.refresh()} isOwner={isOwner} allReps={allReps} />}
    </div>
  );
}

function contextText(followup: Followup, call: CallCtx | undefined): string {
  if (call?.outcome) {
    const label = call.outcome.replace(/_/g, " ");
    return `Last call outcome: ${label}.${call.outcome_reason ? ` ${call.outcome_reason}` : ""}`;
  }
  if (followup.reason) return followup.reason;
  return "Follow-up scheduled after previous call.";
}

function FollowUpCard({
  followup,
  lead,
  call,
  meeting,
  assignedRepLabel,
  createdByLabel,
  busy,
  reschedulePanel,
  newDate,
  setNewDate,
  onToggleReschedule,
  onReschedule,
  onComplete,
  onOpenDetails,
  readOnly,
}: {
  followup: Followup;
  lead: Lead | undefined;
  call: CallCtx | undefined;
  meeting: Meeting | undefined;
  assignedRepLabel: string;
  createdByLabel: string;
  busy: boolean;
  reschedulePanel: boolean;
  newDate: string;
  setNewDate: (v: string) => void;
  onToggleReschedule: () => void;
  onReschedule: () => void;
  onComplete: () => void;
  onOpenDetails: () => void;
  readOnly: boolean;
}) {
  const urgency = formatUrgency(followup.due_at);
  const businessName = lead?.business_name || "Unknown business";
  const title = followup.title || `Follow up with ${businessName}`;

  const primary = (() => {
    switch (followup.followup_type) {
      case "CALL":
        return { label: "Call now", href: `/team/leads/${followup.lead_id}/call`, disabled: false };
      case "MEETING":
        return meeting?.google_meet_url
          ? { label: "Join meeting", href: meeting.google_meet_url, external: true, disabled: false }
          : { label: "Open Lead", href: `/team/leads/${followup.lead_id}`, disabled: false };
      case "EMAIL":
        return lead?.email ? { label: "Send email", href: `mailto:${lead.email}`, disabled: false } : { label: "No email on file", href: null, disabled: true };
      case "RESEARCH":
        return followup.related_research_result_id
          ? { label: "Continue research", href: `/team/research/${followup.related_research_result_id}`, disabled: false }
          : { label: "Open Lead", href: `/team/leads/${followup.lead_id}`, disabled: false };
      default:
        return { label: "Complete follow-up", href: null, disabled: false, isComplete: true };
    }
  })();

  return (
    <div
      style={{ position: "relative", zIndex: 3, width: "100%", minHeight: 560, background: "#101010", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 34, boxShadow: "0 24px 70px rgba(0,0,0,0.34)", overflow: "hidden" }}
    >
      <div style={{ height: 106, padding: "0 42px", display: "flex", alignItems: "center", gap: 14, borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#6F6F73" }}>
        <Clock3 size={28} strokeWidth={1.5} />
        <span style={{ fontSize: 23, fontWeight: 400 }}>{readOnly ? "Completed" : "Coming Up"}</span>
      </div>

      <div style={{ padding: "40px 42px 34px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "start" }}>
          <div style={{ fontSize: 31, fontWeight: 500, letterSpacing: "-0.025em", lineHeight: 1.1, color: "#F5F5F7" }}>{title}</div>
          <button
            onClick={onOpenDetails}
            style={{ height: 58, padding: "0 24px", background: "#171717", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, fontSize: 17, fontWeight: 500, color: "#8F8F93", whiteSpace: "nowrap" }}
          >
            Details ↗
          </button>
        </div>

        <div style={{ marginTop: 18, display: "flex", alignItems: "baseline", gap: 8, fontSize: 23, fontWeight: 400 }}>
          <TypeIcon type={followup.followup_type} />
          <span style={{ color: urgency.color }}>{urgency.text}</span>
        </div>

        <div style={{ marginTop: 26, display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{ width: 42, height: 42, borderRadius: "50%", border: "2px solid #101010", background: "#2A2A2A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: "#F5F5F7" }}
          >
            {assignedRepLabel.slice(0, 1).toUpperCase()}
          </div>
          <span style={{ fontSize: 17, color: "#6F6F73" }}>Assigned to {assignedRepLabel}</span>
        </div>

        <div style={{ marginTop: 34, background: "#171717", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 18, padding: "28px 30px", display: "grid", gridTemplateColumns: "34px 1fr", gap: 12 }}>
          <Sparkles size={26} color="#F5A6CC" />
          <div style={{ fontSize: 18, lineHeight: 1.55, color: "#A8A8AA" }}>{contextText(followup, call)}</div>
        </div>

        {!readOnly && (
          <>
            {primary.href && !primary.external ? (
              <Link
                href={primary.href}
                style={{ marginTop: 34, width: "100%", height: 88, background: "#171717", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, fontSize: 28, fontWeight: 500, color: "#F5F5F7", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                {primary.label}
              </Link>
            ) : primary.href && primary.external ? (
              <a
                href={primary.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginTop: 34, width: "100%", height: 88, background: "#171717", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, fontSize: 28, fontWeight: 500, color: "#F5F5F7", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                {primary.label}
              </a>
            ) : (
              <button
                onClick={primary.isComplete ? onComplete : undefined}
                disabled={primary.disabled || busy}
                style={{ marginTop: 34, width: "100%", height: 88, background: "#171717", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, fontSize: 28, fontWeight: 500, color: "#F5F5F7", display: "flex", alignItems: "center", justifyContent: "center", opacity: primary.disabled ? 0.4 : 1 }}
              >
                {busy ? <Loader2 size={22} className="animate-spin" /> : primary.label}
              </button>
            )}

            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              <button
                onClick={onToggleReschedule}
                style={{ height: 44, background: "#121212", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, fontSize: 13, color: "#A1A1A6", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <CalendarClock size={14} /> Reschedule
              </button>
              <button
                onClick={onComplete}
                disabled={busy}
                style={{ height: 44, background: "#121212", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, fontSize: 13, color: "#A1A1A6", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <Check size={14} /> Complete
              </button>
              <Link
                href={`/team/leads/${followup.lead_id}`}
                style={{ height: 44, background: "#121212", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, fontSize: 13, color: "#A1A1A6", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <ExternalLink size={14} /> Open Lead
              </Link>
            </div>

            {reschedulePanel && (
              <div className="flex items-center gap-2 mt-3">
                <input
                  type="datetime-local"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="h-[40px] rounded-[8px] px-3 text-[13px] outline-none"
                  style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
                />
                <button onClick={onReschedule} disabled={busy} className="h-[40px] px-3.5 rounded-[8px] bg-white text-black text-[12.5px] font-semibold">
                  Save
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TypeIcon({ type }: { type: Followup["followup_type"] }) {
  const Icon = TYPE_ICON[type];
  return <Icon size={20} color="#6F6F73" style={{ marginRight: 2 }} />;
}

function DetailsDrawer({
  followup,
  lead,
  call,
  meeting,
  assignedRepLabel,
  createdByLabel,
  onClose,
}: {
  followup: Followup;
  lead: Lead | undefined;
  call: CallCtx | undefined;
  meeting: Meeting | undefined;
  assignedRepLabel: string;
  createdByLabel: string;
  onClose: () => void;
}) {
  const rows: [string, string][] = [
    ["Business", lead?.business_name || "—"],
    ["Contact", lead?.owner_name || "—"],
    ["Phone", lead?.phone || "—"],
    ["Email", lead?.email || "—"],
    ["Category", lead?.category || "—"],
    ["Reason", followup.reason || "—"],
    ["Last Call Outcome", call?.outcome ? call.outcome.replace(/_/g, " ") : "—"],
    ["Last Objection", call?.outcome && OBJECTION_OUTCOMES.has(call.outcome) ? call.outcome_reason || call.outcome.replace(/_/g, " ") : "—"],
    ["Previous Notes", call?.notes || followup.notes || "—"],
    ["Scheduled Time", `${new Date(followup.due_at).toLocaleString()} (${followup.timezone})`],
    ["Assigned Rep", assignedRepLabel],
    ["Created By", createdByLabel],
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="h-full overflow-y-auto p-7" style={{ width: 420, background: "#141414", borderLeft: "1px solid rgba(255,255,255,0.08)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="text-[16px] font-semibold text-[#F5F5F7]">Follow-Up Details</div>
          <button onClick={onClose} className="text-[#6E6E73] hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          {rows.map(([label, value]) => (
            <div key={label}>
              <div className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">{label}</div>
              <div className="text-[13.5px] text-[#F5F5F7] mt-0.5 leading-relaxed">{value}</div>
            </div>
          ))}
          <Link href={`/team/leads/${followup.lead_id}`} className="mt-2 h-[38px] rounded-[8px] bg-white text-black text-[12.5px] font-semibold flex items-center justify-center">
            Open Related Lead
          </Link>
          {meeting && (
            <div>
              <div className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">Related Meeting</div>
              <div className="text-[13.5px] text-[#F5F5F7] mt-0.5">{new Date(meeting.scheduled_at).toLocaleString()}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickCreateModal({
  onClose,
  onCreated,
  isOwner,
  allReps,
}: {
  onClose: () => void;
  onCreated: () => void;
  isOwner: boolean;
  allReps: { id: string; label: string }[];
}) {
  const [leadQuery, setLeadQuery] = useState("");
  const [leadResults, setLeadResults] = useState<{ id: string; business_name: string | null }[]>([]);
  const [selectedLead, setSelectedLead] = useState<{ id: string; business_name: string | null } | null>(null);
  const [type, setType] = useState<Followup["followup_type"]>("CALL");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [reason, setReason] = useState("");
  const [assignedTo, setAssignedTo] = useState(allReps[0]?.id || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function searchLeads(q: string) {
    setLeadQuery(q);
    if (q.trim().length < 2) {
      setLeadResults([]);
      return;
    }
    const res = await fetch(`/api/team/search?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = await res.json();
      setLeadResults((data.results || []).map((r: any) => ({ id: r.id, business_name: r.business_name })));
    }
  }

  async function submit() {
    if (!selectedLead || !date) {
      setError("Choose a lead and a date.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const dueAt = new Date(`${date}T${time}:00`).toISOString();
      const res = await fetch("/api/team/followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: selectedLead.id, followupType: type, dueAt, timezone, reason, assignedTo: isOwner ? assignedTo : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create follow-up.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.65)" }} onClick={onClose}>
      <div className="w-full max-w-[440px] rounded-[16px] p-6" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="text-[16px] font-semibold text-[#F5F5F7]">New Follow-Up</div>
          <button onClick={onClose} className="text-[#6E6E73] hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">Lead</label>
            {selectedLead ? (
              <div className="mt-1 h-[38px] rounded-[8px] px-3 flex items-center justify-between text-[13px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}>
                {selectedLead.business_name || "Unknown"}
                <button onClick={() => setSelectedLead(null)} className="text-[#6E6E73] hover:text-white">
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div className="relative mt-1">
                <input
                  value={leadQuery}
                  onChange={(e) => searchLeads(e.target.value)}
                  placeholder="Search leads…"
                  className="w-full h-[38px] rounded-[8px] px-3 text-[13px] outline-none"
                  style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
                />
                {leadResults.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 rounded-[8px] overflow-hidden z-10" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {leadResults.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => {
                          setSelectedLead(r);
                          setLeadResults([]);
                        }}
                        className="w-full text-left px-3 py-2 text-[13px] text-[#F5F5F7] hover:bg-white/5"
                      >
                        {r.business_name || "Unnamed"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as any)} className="w-full mt-1 h-[38px] rounded-[8px] px-3 text-[13px] outline-none" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}>
              {(["CALL", "MEETING", "EMAIL", "TASK", "RESEARCH"] as const).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {isOwner && allReps.length > 0 && (
            <div>
              <label className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">Assigned Rep</label>
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full mt-1 h-[38px] rounded-[8px] px-3 text-[13px] outline-none" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}>
                {allReps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full mt-1 h-[38px] rounded-[8px] px-3 text-[13px] outline-none" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }} />
            </div>
            <div>
              <label className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">Time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full mt-1 h-[38px] rounded-[8px] px-3 text-[13px] outline-none" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }} />
            </div>
          </div>

          <div>
            <label className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">Reason</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full mt-1 h-[38px] rounded-[8px] px-3 text-[13px] outline-none" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }} />
          </div>

          {error && <p className="text-[12.5px] text-[#FF453A]">{error}</p>}

          <button onClick={submit} disabled={saving} className="h-[42px] rounded-[8px] bg-white text-black text-[13px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60 mt-1">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null} {saving ? "Creating…" : "Create Follow-Up"}
          </button>
        </div>
      </div>
    </div>
  );
}
