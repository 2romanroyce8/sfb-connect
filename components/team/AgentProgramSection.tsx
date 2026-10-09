"use client";

import { useCallback, useEffect, useState } from "react";
import { STATUS_LABEL, type ModuleStatus } from "@/lib/agentProgram/config";

type Mod = { key: string; position: number; name: string; status: ModuleStatus; updated_at: string | null };

/** Owner-only: the public status of each SFB Agent module (drives /agent, the homepage teaser and every customer dashboard). */
export default function AgentProgramSection() {
  const [mods, setMods] = useState<Mod[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await fetch("/api/team/agent-program", { cache: "no-store" }); const j = await r.json();
    if (r.ok) setMods(j.modules); else setMsg(j.error);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const set = async (key: string, status: ModuleStatus) => {
    setBusy(key); setMsg(null);
    const r = await fetch("/api/team/agent-program", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, status }) });
    const j = await r.json(); setBusy(null);
    if (!r.ok) { setMsg(j.error); return; }
    setMsg("Saved — the public page updates on its next load."); void load();
  };
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] text-[#A1A1A6] mb-1">These statuses appear on sfbconnect.com/agent, the homepage, and every customer&apos;s dashboard. Change them here when a module ships — no deploy needed.</p>
      {mods.map((m) => (
        <div key={m.key} className="flex items-center justify-between gap-3 rounded-[10px] px-3 py-2" style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[13px] text-[#F5F5F7]"><span className="text-[#6E6E73] mr-2">{m.position}</span>{m.name}</div>
          <select value={m.status} disabled={busy === m.key} onChange={(e) => set(m.key, e.target.value as ModuleStatus)} className="h-[30px] rounded-[7px] px-2 text-[12px] outline-none" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F5F7" }}>
            {(Object.keys(STATUS_LABEL) as ModuleStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
      ))}
      {msg && <div className="text-[12px] text-[#A1A1A6]">{msg}</div>}
    </div>
  );
}
