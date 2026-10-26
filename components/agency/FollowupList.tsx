"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Row = { id: string; title: string; due_at: string; lead_id: string; lead: string };
export default function FollowupList({ rows }: { rows: Row[] }) {
  const router = useRouter(); const [busy, setBusy] = useState<string | null>(null); const now = Date.now();
  async function done(id: string) { setBusy(id); await fetch("/api/app/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "done", followup_id: id }) }); setBusy(null); router.refresh(); }
  if (!rows.length) return <div className="mt-6 text-[13px] text-[color:var(--hx-6e6e73)]">Nothing due. Follow-ups you add to leads show up here.</div>;
  return <div className="mt-5 flex flex-col gap-2">{rows.map((f) => { const late = new Date(f.due_at).getTime() < now; return (
    <div key={f.id} className="rounded-[12px] px-4 py-3 flex items-center gap-3" style={{ background: "var(--hx-111111)", border: "1px solid rgb(var(--w) / 0.07)" }}>
      <div className="mr-auto min-w-0"><div className="text-[14px] font-medium truncate">{f.title}</div><div className="text-[12px] text-[color:var(--hx-6e6e73)]"><Link href={`/app/leads/${f.lead_id}`} className="hover:underline">{f.lead}</Link> · <span style={late ? { color: "var(--hx-ff453a)" } : undefined}>{late ? "Overdue · " : ""}{new Date(f.due_at).toLocaleString()}</span></div></div>
      <button disabled={busy === f.id} onClick={() => void done(f.id)} className="h-[32px] px-3 rounded-full text-[12px] font-semibold" style={{ border: "1px solid rgb(var(--w) / 0.14)" }}>{busy === f.id ? "…" : "Done"}</button>
    </div>); })}</div>;
}
