"use client";

import { useCallback, useEffect, useState } from "react";

type Biz = { id: string; legal_name: string | null; plan_key: string | null; agent_overseer_id: string | null; created_at: string };
type Member = { id: string; full_name: string | null; email: string; team_role: string };

/** Owner-only: assign the human overseer for each customer's SFB Agent. */
export default function OverseerAssignments() {
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [team, setTeam] = useState<Member[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch("/api/team/businesses/overseer", { cache: "no-store" }); const j = await r.json();
    if (r.ok) { setBusinesses(j.businesses); setTeam(j.team); } else setMsg(j.error);
    setLoaded(true);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const assign = async (businessId: string, overseerId: string) => {
    setBusy(businessId); setMsg(null);
    const r = await fetch("/api/team/businesses/overseer", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ businessId, overseerId: overseerId || null }) });
    const j = await r.json(); setBusy(null);
    if (!r.ok) { setMsg(j.error); return; }
    setMsg("Saved. The customer sees their overseer on their dashboard immediately."); void load();
  };
  const name = (m: Member) => m.full_name || m.email;
  return (
    <div className="px-8 pb-10 max-w-[960px]">
      <div className="rounded-[12px] p-5" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="text-[13px] font-semibold text-[#F5F5F7] mb-1">Agent overseers (customers)</div>
        <p className="text-[12px] text-[#A1A1A6] mb-3">Every customer&apos;s SFB Agent has one human overseer. Pick who it is here; the name and role appear on that customer&apos;s dashboard.</p>
        {!loaded ? <div className="text-[12px] text-[#6E6E73]">Loading…</div> : businesses.length === 0 ? (
          <div className="text-[12.5px] text-[#6E6E73]">No customer businesses yet. When a customer buys an SFB Agent plan (or a lead is marked Won), they appear here.</div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {businesses.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 rounded-[10px] px-3 py-2" style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="min-w-0">
                  <div className="text-[13px] text-[#F5F5F7] truncate">{b.legal_name || "Unnamed business"}</div>
                  <div className="text-[11px] text-[#6E6E73]">{b.plan_key ? b.plan_key.replace(/_/g, " ") : "no plan"}</div>
                </div>
                <select value={b.agent_overseer_id ?? ""} disabled={busy === b.id} onChange={(e) => assign(b.id, e.target.value)} className="h-[30px] rounded-[7px] px-2 text-[12px] outline-none shrink-0" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F5F7" }}>
                  <option value="">Unassigned</option>
                  {team.map((m) => <option key={m.id} value={m.id}>{name(m)}{m.team_role === "owner" ? " (owner)" : ""}</option>)}
                </select>
              </li>
            ))}
          </ul>
        )}
        {msg && <div className="text-[12px] text-[#A1A1A6] mt-2">{msg}</div>}
      </div>
    </div>
  );
}
