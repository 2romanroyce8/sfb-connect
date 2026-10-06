"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Cat = { key: string; table: string; label: string; group: string; inReset: boolean; count: number | null; error: string | null };
type Row = { id: string; label: string; created_at: string | null; row: Record<string, unknown> };
type LogRow = { id: number; kind: string; category: string; row_id: string | null; rows_deleted: number; created_at: string; actor_email: string | null };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "");
const btn = (danger = false): React.CSSProperties => danger
  ? { background: "rgba(255,69,58,0.12)", color: "#FF6961", border: "1px solid rgba(255,69,58,0.3)" }
  : { background: "#101010", color: "#F5F5F7", border: "1px solid rgba(255,255,255,0.12)" };

/** Owner-only. Delete any single record or an entire category, or reset the
 * whole workspace. Every action is snapshotted server-side before deletion. */
export default function DangerZoneSection() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [resetPhrase, setResetPhrase] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/team/data", { cache: "no-store" });
    const j = await res.json();
    if (!res.ok) { setMsg(j.error || "Could not load data overview"); return; }
    setCats(j.categories); setLog(j.log); setResetPhrase(j.resetPhrase);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const openCat = async (key: string) => {
    if (open === key) { setOpen(null); return; }
    setOpen(key); setRows([]);
    const res = await fetch(`/api/team/data?category=${key}`, { cache: "no-store" });
    const j = await res.json();
    if (res.ok) setRows(j.rows); else setMsg(j.error);
  };

  const del = async (key: string, id: string, label: string) => {
    if (!confirm(`Delete "${label}" permanently? A copy is kept in the deletion log.`)) return;
    setBusy(`${key}:${id}`);
    const res = await fetch(`/api/team/data/${key}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const j = await res.json();
    setBusy(null);
    if (!res.ok) { setMsg(j.error); return; }
    setRows((r) => r.filter((x) => x.id !== id)); void load();
  };

  const delAll = async (c: Cat) => {
    if (!confirm(`Delete ALL ${c.count ?? ""} rows in "${c.label}"? A copy is kept in the deletion log.`)) return;
    if (!confirm(`Last check — wipe every row of ${c.label}?`)) return;
    setBusy(`all:${c.key}`);
    const res = await fetch(`/api/team/data/${c.key}?all=1`, { method: "DELETE" });
    const j = await res.json();
    setBusy(null);
    if (!res.ok) { setMsg(j.error); return; }
    setMsg(`Deleted ${j.deleted} ${c.label}.`); setRows([]); void load();
  };

  const reset = async () => {
    if (typed !== resetPhrase) return;
    if (!confirm("This wipes every lead, research result, audit, call, meeting, follow-up, note, clock session, leaderboard point, work plan and territory assignment for the whole team. Users, roles, folders, markets and connected agents stay. A full backup snapshot is saved first. Continue?")) return;
    setBusy("reset"); setResetResult(null);
    const res = await fetch("/api/team/data/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: typed }) });
    const j = await res.json();
    setBusy(null); setTyped("");
    if (!res.ok) { setResetResult(j.error || "Reset failed"); return; }
    const fails = Object.keys(j.failures ?? {});
    setResetResult(`Reset complete — ${j.total} rows cleared across ${Object.keys(j.deleted).length} tables${fails.length ? `; ${fails.length} table(s) failed: ${fails.join(", ")}` : ""}. Backup #${j.backupId} saved.`);
    void load();
  };

  const groups = useMemo(() => {
    const m = new Map<string, Cat[]>();
    for (const c of cats) { if (!showAll && (c.count ?? 0) === 0) continue; if (!m.has(c.group)) m.set(c.group, []); m.get(c.group)!.push(c); }
    return [...m.entries()];
  }, [cats, showAll]);
  const totalRows = cats.reduce((a, c) => a + (c.inReset ? c.count ?? 0 : 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-[#A1A1A6]">Only you (the owner) see this. Delete any record or whole category, or reset the entire workspace. Every deletion is snapshotted to a deletion log first, so a mistake can be recovered.</p>
      {msg && <div className="text-[12px] text-[#FFD60A]">{msg}</div>}

      <div className="flex items-center justify-between">
        <div className="text-[12px] uppercase tracking-wide text-[#6E6E73]">Data by category</div>
        <label className="text-[11.5px] text-[#A1A1A6] flex items-center gap-1.5"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> show empty categories</label>
      </div>
      {groups.length === 0 && <div className="text-[12.5px] text-[#6E6E73]">No data — the workspace is empty.</div>}
      {groups.map(([group, list]) => (
        <div key={group}>
          <div className="text-[11.5px] text-[#6E6E73] mb-1.5">{group}</div>
          <ul className="flex flex-col gap-1.5">
            {list.map((c) => (
              <li key={c.key} className="rounded-[10px]" style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <button onClick={() => openCat(c.key)} className="text-left flex-1 text-[13px] text-[#F5F5F7]">
                    {c.label} <span className="text-[#6E6E73] text-[12px]">· {c.count ?? "?"} {c.inReset ? "" : "· kept by reset"}</span>
                  </button>
                  <button onClick={() => openCat(c.key)} className="h-[28px] px-2.5 rounded-[7px] text-[11.5px]" style={btn()}>{open === c.key ? "Hide" : "Browse"}</button>
                  <button onClick={() => delAll(c)} disabled={!c.count || busy === `all:${c.key}`} className="h-[28px] px-2.5 rounded-[7px] text-[11.5px] font-semibold disabled:opacity-40" style={btn(true)}>{busy === `all:${c.key}` ? "Deleting…" : "Delete all"}</button>
                </div>
                {open === c.key && (
                  <div className="px-3 pb-2">
                    {rows.length === 0 ? <div className="text-[12px] text-[#6E6E73] py-1">{c.count ? "Loading…" : "Nothing here."}</div> : (
                      <ul className="flex flex-col divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                        {rows.map((r) => (
                          <li key={r.id} className="flex items-center justify-between gap-3 py-1.5">
                            <div className="min-w-0">
                              <div className="text-[12.5px] text-[#F5F5F7] truncate">{r.label}</div>
                              <div className="text-[11px] text-[#6E6E73] font-mono truncate">{r.id}{r.created_at ? ` · ${fmt(r.created_at)}` : ""}</div>
                            </div>
                            <button onClick={() => del(c.key, r.id, r.label)} disabled={busy === `${c.key}:${r.id}`} className="h-[26px] px-2.5 rounded-[7px] text-[11.5px] font-semibold shrink-0 disabled:opacity-40" style={btn(true)}>Delete</button>
                          </li>
                        ))}
                        {rows.length >= 50 && <li className="text-[11px] text-[#6E6E73] py-1">Showing the 50 most recent. Delete some to see older rows, or use Delete all.</li>}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="rounded-[12px] p-4 mt-2" style={{ background: "rgba(255,69,58,0.06)", border: "1px solid rgba(255,69,58,0.3)" }}>
        <div className="text-[13px] font-semibold" style={{ color: "#FF6961" }}>Reset workspace</div>
        <p className="text-[12px] text-[#A1A1A6] mt-1">Wipes all operational data for the whole team ({totalRows} rows right now): leads, pipeline, research queue, audits, calls, meetings, follow-ups, notes, notifications, clock sessions, leaderboard, work plans, territories, documents, demo requests. Keeps users and roles, document folders, markets, scoring rules, calendar connections and connected agents. A full backup snapshot is stored in the deletion log before anything is removed.</p>
        <div className="mt-3 flex flex-col gap-2">
          <label className="text-[11px] uppercase tracking-wide text-[#6E6E73]">Type <span className="font-mono text-[#F5F5F7]">{resetPhrase}</span> to enable</label>
          <div className="flex items-center gap-2">
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={resetPhrase} className="flex-1 h-[36px] rounded-[8px] px-3 text-[13px] outline-none font-mono" style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }} />
            <button onClick={reset} disabled={typed !== resetPhrase || busy === "reset"} className="h-[36px] px-4 rounded-[8px] text-[12.5px] font-semibold disabled:opacity-40" style={{ background: "#FF453A", color: "#000" }}>{busy === "reset" ? "Resetting…" : "Reset workspace"}</button>
          </div>
          {resetResult && <div className="text-[12px] text-[#F5F5F7]">{resetResult}</div>}
        </div>
      </div>

      {log.length > 0 && (
        <details>
          <summary className="text-[12px] text-[#A1A1A6] cursor-pointer">Deletion log ({log.length} most recent)</summary>
          <ul className="mt-2 flex flex-col gap-1 text-[11.5px]">
            {log.map((l) => (
              <li key={l.id} className="text-[#A1A1A6]"><span className="text-[#6E6E73]">{fmt(l.created_at)}</span> · <span className="text-[#F5F5F7]">{l.kind}</span> · {l.category}{l.row_id ? ` · ${l.row_id.slice(0, 8)}…` : ""} · {l.rows_deleted} row(s) · {l.actor_email ?? ""} · backup #{l.id}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
