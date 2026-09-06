"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Archive, ArchiveRestore, Trash2, UserCog } from "lucide-react";

export default function LeadActions({
  leadId,
  archived,
  isOwner,
  reps,
  currentAssignedRep,
}: {
  leadId: string;
  archived: boolean;
  isOwner: boolean;
  reps: { id: string; label: string }[];
  currentAssignedRep: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleArchive() {
    setBusy(true);
    try {
      await fetch(`/api/team/leads/${leadId}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: !archived }),
      });
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deleteLead() {
    if (!confirm("Delete this lead permanently? This can't be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/team/leads/${leadId}`, { method: "DELETE" });
      if (res.ok) router.push("/team/leads");
    } finally {
      setBusy(false);
    }
  }

  async function reassign(repId: string) {
    setBusy(true);
    try {
      await fetch(`/api/team/leads/${leadId}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repId }),
      });
      setReassigning(false);
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-[36px] w-[36px] inline-flex items-center justify-center rounded-[8px] text-[#A1A1A6] hover:text-white"
        style={{ border: "1px solid rgba(255,255,255,0.10)" }}
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 w-[200px] rounded-[10px] p-1.5 z-20" style={{ background: "#151515", border: "1px solid rgba(255,255,255,0.1)" }}>
          <button onClick={toggleArchive} disabled={busy} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-[7px] text-[12.5px] text-[#A1A1A6] hover:text-white hover:bg-[#1c1c1c] text-left">
            {archived ? <ArchiveRestore size={13} /> : <Archive size={13} />} {archived ? "Unarchive" : "Archive"}
          </button>
          {isOwner && (
            <button onClick={() => setReassigning((v) => !v)} disabled={busy} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-[7px] text-[12.5px] text-[#A1A1A6] hover:text-white hover:bg-[#1c1c1c] text-left">
              <UserCog size={13} /> Reassign
            </button>
          )}
          {reassigning && (
            <div className="px-1.5 py-1 flex flex-col gap-1">
              {reps.map((r) => (
                <button
                  key={r.id}
                  onClick={() => reassign(r.id)}
                  className="text-left px-2 py-1.5 rounded-[6px] text-[12px]"
                  style={{ background: currentAssignedRep === r.id ? "#1c1c1c" : "transparent", color: "#A1A1A6" }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
          {isOwner && (
            <button onClick={deleteLead} disabled={busy} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-[7px] text-[12.5px] text-[#FF453A] hover:bg-[#1c1c1c] text-left">
              <Trash2 size={13} /> Delete Lead
            </button>
          )}
        </div>
      )}
    </div>
  );
}
