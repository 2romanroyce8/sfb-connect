"use client";

import { useCallback, useEffect, useState } from "react";

type Row = { business_id: string; email: string; status: string; submitted_at: string; cleared_at: string | null; connected_at: string | null; denied_count: number; business_name: string | null };
type Overview = { count: number; cap: number; label: string; blocked: boolean; manualBlock: boolean; alertsFired: number[]; verificationTaskId: string | null; consoleUrl: string; rows: Row[] };

/** Team counter + clearance queue for the Google testing-mode gate (owner only). */
export default function GoogleGatePanel() {
  const [o, setO] = useState<Overview | null>(null); const [busy, setBusy] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => { const r = await fetch("/api/team/google-gate", { cache: "no-store" }); if (r.ok) setO(await r.json()); }, []);
  useEffect(() => { void load(); }, [load]);
  const post = async (body: Record<string, unknown>) => { const r = await fetch("/api/team/google-gate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "Failed."); return j; };
  const clear = async (id: string) => { setBusy(id); setMsg(null); try { const j = await post({ action: "mark_cleared", businessId: id }); setMsg(`Cleared. ${j.count} / ${o?.cap} test users.`); await load(); } catch (e) { setMsg(e instanceof Error ? e.message : "Failed."); } finally { setBusy(null); } };
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); setMsg(`Copied ${t}`); } catch { setMsg(t); } };
  if (!o) return <div className="text-[12.5px] text-[#6E6E73]">Loading…</div>;
  const pct = Math.round((o.count / o.cap) * 100); const color = o.count >= 95 ? "#FF453A" : o.count >= 85 ? "#FF9F0A" : o.count >= 70 ? "#FFD60A" : "#30D158";
  return (
    <div id="google-gate" className="flex flex-col gap-3 scroll-mt-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div><div className="text-[15px] font-semibold text-[#F5F5F7]">{o.label}</div><div className="text-[12px] text-[#6E6E73]">The OAuth app stays in testing mode on purpose until Google verification completes. Alerts at 70 · 85 · 95{o.alertsFired.length ? ` (fired: ${o.alertsFired.join(", ")})` : ""}.{o.verificationTaskId ? " Verification task created." : ""}</div></div>
        <a href={o.consoleUrl} target="_blank" rel="noopener noreferrer" className="h-[32px] px-3.5 rounded-[8px] text-[12px] font-semibold bg-white text-black inline-flex items-center">Open Cloud Console → Test users</a>
      </div>
      <div className="h-2 rounded-full bg-white/[0.08] overflow-hidden"><div className="h-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} /></div>
      {o.blocked && <div className="text-[12.5px] text-[#FF9F9A]">New clearances are blocked{o.manualBlock ? " (manual)" : " (cap guard at 95)"} — customers see the &quot;almost ready&quot; state.</div>}
      {msg && <div className="text-[12px] text-[#A1A1A6]">{msg}</div>}
      <div className="rounded-[10px] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        {o.rows.length === 0 ? <div className="p-3 text-[12.5px] text-[#6E6E73]">No Google addresses submitted yet.</div> : o.rows.map((r) => (
          <div key={r.business_id} className="grid items-center gap-3 px-3 py-2.5 text-[12.5px]" style={{ gridTemplateColumns: "1fr 1fr 110px 120px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="min-w-0"><button onClick={() => copy(r.email)} title="Copy" className="font-mono text-[#F5F5F7] truncate max-w-full hover:underline">{r.email}</button>{r.denied_count > 0 && <span className="ml-2 text-[#FF9F9A]">· blocked by Google ×{r.denied_count}</span>}</div>
            <div className="text-[#A1A1A6] truncate">{r.business_name ?? "—"}</div>
            <div style={{ color: r.status === "connected" ? "#30D158" : r.status === "cleared" ? "#0A84FF" : "#FFD60A" }}>{r.status.replace("_", " ")}</div>
            <div>{r.status === "email_submitted" ? <button onClick={() => clear(r.business_id)} disabled={busy === r.business_id || o.blocked} className="h-[28px] px-3 rounded-[7px] text-[12px] font-semibold bg-[#30D158] text-black disabled:opacity-50">{busy === r.business_id ? "…" : "Mark cleared"}</button> : <span className="text-[#6E6E73]">{r.connected_at ? new Date(r.connected_at).toLocaleDateString() : r.cleared_at ? new Date(r.cleared_at).toLocaleDateString() : ""}</span>}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
