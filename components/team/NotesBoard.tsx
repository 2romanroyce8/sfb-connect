"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pin, Plus } from "lucide-react";

type Note = { id: string; lead_id: string; author_id: string | null; note_type: string; note: string; created_at: string };

export default function NotesBoard({
  notes,
  leadMap,
  authorMap,
  isOwner,
  myLeads,
  currentUserId,
}: {
  notes: Note[];
  leadMap: Record<string, string>;
  authorMap: Record<string, string>;
  isOwner: boolean;
  myLeads: { id: string; name: string }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [selectedLead, setSelectedLead] = useState(myLeads[0]?.id || "");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [pinned, setPinned] = useState<Set<string>>(new Set());

  const authorOptions = useMemo(() => Array.from(new Set(Object.values(authorMap))), [authorMap]);

  const filtered = notes.filter((n) => {
    const leadName = leadMap[n.lead_id] || "";
    const authorName = n.author_id ? authorMap[n.author_id] || "" : "";
    if (query && !leadName.toLowerCase().includes(query.toLowerCase()) && !n.note.toLowerCase().includes(query.toLowerCase())) return false;
    if (authorFilter && authorName !== authorFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const ap = pinned.has(a.id) ? 1 : 0;
    const bp = pinned.has(b.id) ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  async function submitNote() {
    if (!content.trim() || !selectedLead) return;
    setSaving(true);
    try {
      await fetch(`/api/team/leads/${selectedLead}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: content }),
      });
      setContent("");
      setShowNew(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-semibold text-[#F5F5F7]">Notes</div>
          <div className="text-[13px] text-[#6E6E73] mt-1">{notes.length} note{notes.length === 1 ? "" : "s"}</div>
        </div>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="h-[38px] px-4 inline-flex items-center gap-1.5 rounded-[8px] bg-white text-black text-[13px] font-semibold"
        >
          <Plus size={14} /> New Note
        </button>
      </div>

      {showNew && (
        <div className="rounded-[12px] p-4 mb-6 flex flex-col gap-3 max-w-[560px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <select
            value={selectedLead}
            onChange={(e) => setSelectedLead(e.target.value)}
            className="h-[36px] rounded-[8px] px-3 text-[13px] outline-none"
            style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
          >
            {myLeads.length === 0 && <option value="">No leads available</option>}
            {myLeads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write a note…"
            className="h-[90px] resize-none rounded-[8px] p-2.5 text-[13px] outline-none"
            style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
          />
          <button
            onClick={submitNote}
            disabled={saving || !selectedLead}
            className="self-start h-[34px] px-4 rounded-[8px] bg-white text-black text-[12.5px] font-semibold disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Note"}
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes or business…"
          className="h-[36px] w-[260px] rounded-[8px] px-3 text-[12.5px] outline-none"
          style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
        />
        {isOwner && (
          <select
            value={authorFilter}
            onChange={(e) => setAuthorFilter(e.target.value)}
            className="h-[36px] rounded-[8px] px-3 text-[12.5px] outline-none"
            style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
          >
            <option value="">All authors</option>
            {authorOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-[14px] p-10 text-center max-w-[480px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[14px] text-[#A1A1A6]">No notes match.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-w-[720px]">
          {sorted.map((n) => (
            <div key={n.id} className="p-4 rounded-[12px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center justify-between mb-1.5">
                <Link href={`/team/leads/${n.lead_id}`} className="text-[12.5px] text-[#F5F5F7] hover:underline">
                  {leadMap[n.lead_id] || "Unknown lead"}
                </Link>
                <button
                  onClick={() =>
                    setPinned((prev) => {
                      const next = new Set(prev);
                      next.has(n.id) ? next.delete(n.id) : next.add(n.id);
                      return next;
                    })
                  }
                  className="text-[#6E6E73] hover:text-white"
                >
                  <Pin size={13} fill={pinned.has(n.id) ? "currentColor" : "none"} />
                </button>
              </div>
              <p className="text-[13.5px] text-[#F5F5F7] leading-relaxed mb-1.5">{n.note}</p>
              <div className="text-[11px] text-[#6E6E73] capitalize">
                {n.note_type} · {n.author_id ? authorMap[n.author_id] || "Unknown" : "System"} · {new Date(n.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
