"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  UserPlus,
  SearchCheck,
  CheckCircle2,
  Gauge,
  Sparkles,
  Phone,
  PhoneOff,
  CalendarClock,
  Bell,
  Kanban,
  Trophy,
  XCircle,
  StickyNote,
  Users,
} from "lucide-react";

type Activity = { id: string; lead_id: string | null; rep_id: string | null; activity_type: string; description: string | null; created_at: string };

const TYPE_ICON: Record<string, React.ElementType> = {
  lead_imported: UserPlus,
  research_completed: SearchCheck,
  audit_completed: Gauge,
  opportunity_generated: CheckCircle2,
  script_generated: Sparkles,
  call_started: Phone,
  call_ended: PhoneOff,
  follow_up_updated: Bell,
  pipeline_changed: Kanban,
  note_added: StickyNote,
  team_invited: Users,
};

function iconFor(type: string) {
  if (TYPE_ICON[type]) return TYPE_ICON[type];
  if (type.includes("won")) return Trophy;
  if (type.includes("lost")) return XCircle;
  if (type.includes("meeting")) return CalendarClock;
  return CheckCircle2;
}

export default function ActivityFeed({
  activities,
  leadMap,
  repMap,
  isOwner,
}: {
  activities: Activity[];
  leadMap: Record<string, string>;
  repMap: Record<string, string>;
  isOwner: boolean;
}) {
  const [typeFilter, setTypeFilter] = useState("");
  const [repFilter, setRepFilter] = useState("");
  const [query, setQuery] = useState("");

  const types = useMemo(() => Array.from(new Set(activities.map((a) => a.activity_type))), [activities]);
  const reps = useMemo(() => Array.from(new Set(Object.values(repMap))), [repMap]);

  const filtered = activities.filter((a) => {
    if (typeFilter && a.activity_type !== typeFilter) return false;
    if (repFilter && (!a.rep_id || repMap[a.rep_id] !== repFilter)) return false;
    if (query) {
      const leadName = a.lead_id ? leadMap[a.lead_id] || "" : "";
      const text = `${leadName} ${a.description || ""}`.toLowerCase();
      if (!text.includes(query.toLowerCase())) return false;
    }
    return true;
  });

  if (activities.length === 0) {
    return (
      <div className="px-8 py-8">
        <div className="rounded-[14px] p-10 text-center max-w-[480px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[15px] font-medium text-[#F5F5F7] mb-1.5">Nothing has happened yet</div>
          <p className="text-[13px] text-[#A1A1A6]">Research a business or start a call and it'll show up here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <div className="text-[20px] font-semibold text-[#F5F5F7]">Activity</div>
        <div className="text-[13px] text-[#6E6E73] mt-1">{filtered.length} of {activities.length} events</div>
      </div>

      <div className="flex items-center gap-2 mb-5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="h-[36px] w-[220px] rounded-[8px] px-3 text-[12.5px] outline-none"
          style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-[36px] rounded-[8px] px-3 text-[12.5px] outline-none"
          style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
        >
          <option value="">All events</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        {isOwner && (
          <select
            value={repFilter}
            onChange={(e) => setRepFilter(e.target.value)}
            className="h-[36px] rounded-[8px] px-3 text-[12.5px] outline-none"
            style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
          >
            <option value="">All reps</option>
            {reps.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-col gap-1 max-w-[720px]">
        {filtered.map((a) => {
          const Icon = iconFor(a.activity_type);
          return (
            <div key={a.id} className="flex items-start gap-3 p-3 rounded-[10px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}>
              <Icon size={15} className="text-[#6E6E73] mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-[13px] text-[#F5F5F7]">
                  {a.description || a.activity_type.replace(/_/g, " ")}
                  {a.lead_id && leadMap[a.lead_id] && (
                    <>
                      {" · "}
                      <Link href={`/team/leads/${a.lead_id}`} className="text-[#0A84FF] hover:underline">
                        {leadMap[a.lead_id]}
                      </Link>
                    </>
                  )}
                </div>
                <div className="text-[11px] text-[#6E6E73] mt-0.5">
                  {isOwner && a.rep_id && repMap[a.rep_id] ? `${repMap[a.rep_id]} · ` : ""}
                  {new Date(a.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
