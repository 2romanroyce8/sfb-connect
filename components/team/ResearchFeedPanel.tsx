"use client";

import { useCallback, useEffect, useState } from "react";

type Target = { id: string; vertical: string; city: string; state: string; active: boolean; last_run_at: string | null };
type Run = { id: string; trigger: string; status: string; started_at: string; finished_at: string | null; pulled: number; accepted: number; dropped: Record<string, number>; tasks_created: number; errors: string[]; targets_run: string[]; targets_skipped: string[] };
type Finding = { id: string; business_name: string; website: string | null; phone_e164: string | null; city: string | null; state: string | null; identity_label: string; accepted: boolean; quality_flags: string[]; task_id: string | null; source_kind: string; created_at: string };
type Status = { targets: Target[]; sources: { id: string; url: string; label: string; active: boolean }[]; runs: Run[]; findings: Finding[]; settings: { enabled: boolean; schedule: string; token_rotated_at: string | null } | null; exaConfigured: boolean };

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "never");
const LABEL_COLOR: Record<string, string> = { corroborated: "#30D158", name_only: "#FFD60A", unverified: "#A1A1A6" };

/** Nightly prospect feed — status, targets, last runs, recent findings, Run now (owner). */
export default function ResearchFeedPanel({ isOwner }: { isOwner: boolean }) {
  const [s, setS] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/team/research-feed", { cache: "no-store" });
    if (r.ok) setS(await r.json());
  }, []);
  useEffect(() => { void load(); }, [load]);

  const runNow = async (dryRun: boolean) => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/team/research-feed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dryRun }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Run failed");
      const dropped = Object.entries(j.dropped as Record<string, number>).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k.replace(/_/g, " ")}`).join(", ");
      setMsg(`${dryRun ? "Dry run" : "Run"} finished: ${j.pulled} pulled · ${j.accepted} accepted · ${j.tasksCreated.length} task${j.tasksCreated.length === 1 ? "" : "s"} filed${dropped ? ` · dropped: ${dropped}` : ""}${j.targetsSkipped.length ? ` · ${j.targetsSkipped.length} target(s) deferred to next run` : ""}${j.errors.length ? ` · errors: ${j.errors.join("; ")}` : ""}`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(false);
    }
  };

  const last = s?.runs[0] ?? null;
  return (
    <div className="rounded-[12px] p-4 mb-5" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[13px] font-semibold text-[#F5F5F7]">Nightly prospect feed <span className="ml-1.5 text-[10.5px] uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: s?.settings?.enabled === false ? "rgba(255,69,58,0.12)" : "rgba(48,209,88,0.12)", color: s?.settings?.enabled === false ? "#FF6961" : "#30D158" }}>{s ? (s.settings?.enabled === false ? "paused" : "on") : "…"}</span></div>
          <div className="text-[11.5px] text-[#6E6E73] mt-0.5">
            {s ? <>Exa {s.exaConfigured ? "configured" : <span className="text-[#FF9F0A]">not configured</span>} · {s.sources.filter((x) => x.active).length} RSS feed{s.sources.filter((x) => x.active).length === 1 ? "" : "s"} · {s.targets.filter((t) => t.active).length} target{s.targets.filter((t) => t.active).length === 1 ? "" : "s"} · schedule <span className="font-mono">{s.settings?.schedule ?? "—"}</span> UTC · last run {last ? <>{fmt(last.started_at)} — {last.accepted} accepted, {last.tasks_created} task{last.tasks_created === 1 ? "" : "s"}{last.errors?.length ? <span className="text-[#FF9F0A]"> · {last.errors.length} error{last.errors.length === 1 ? "" : "s"}</span> : null}</> : "never"}</> : "Loading…"}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setOpen((v) => !v)} className="h-[30px] px-3 rounded-[8px] text-[12px] text-[#A1A1A6]" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>{open ? "Hide" : "Details"}</button>
          {isOwner && <button onClick={() => runNow(true)} disabled={busy} className="h-[30px] px-3 rounded-[8px] text-[12px] text-[#F5F5F7] disabled:opacity-60" style={{ border: "1px solid rgba(255,255,255,0.14)" }}>{busy ? "Running…" : "Dry run"}</button>}
          {isOwner && <button onClick={() => runNow(false)} disabled={busy} className="h-[30px] px-3 rounded-[8px] text-[12px] font-semibold bg-white text-black disabled:opacity-60">{busy ? "Running…" : "Run now"}</button>}
        </div>
      </div>
      {msg && <div className="mt-2 text-[12px] text-[#A1A1A6]">{msg}</div>}
      {open && s && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[#6E6E73] mb-1.5">Targets</div>
            <ul className="text-[12px] space-y-1">
              {s.targets.map((t) => <li key={t.id} className="flex justify-between gap-2"><span className="text-[#F5F5F7]">{t.vertical} · {t.city}, {t.state}{!t.active && <span className="text-[#6E6E73]"> (off)</span>}</span><span className="text-[#6E6E73]">last {fmt(t.last_run_at)}</span></li>)}
            </ul>
            <div className="text-[11px] uppercase tracking-wide text-[#6E6E73] mt-3 mb-1.5">RSS sources</div>
            <ul className="text-[12px] space-y-1">{s.sources.map((x) => <li key={x.id} className="text-[#A1A1A6] truncate">{x.label} <span className="text-[#6E6E73]">— {x.url}</span></li>)}</ul>
            <div className="text-[11px] text-[#6E6E73] mt-3">Targets and feeds are rows in research_feed_targets / research_feed_sources — edit there, no deploy needed. See docs/runbooks/research-adapters.md.</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[#6E6E73] mb-1.5">Recent findings</div>
            {s.findings.length === 0 ? <div className="text-[12px] text-[#6E6E73]">No findings yet.</div> : (
              <ul className="text-[12px] space-y-1 max-h-[320px] overflow-auto pr-1">
                {s.findings.map((f) => (
                  <li key={f.id} className="flex items-start justify-between gap-2" style={{ opacity: f.accepted ? 1 : 0.55 }}>
                    <span className="min-w-0"><span className="text-[#F5F5F7]">{f.business_name}</span> <span style={{ color: LABEL_COLOR[f.identity_label] ?? "#A1A1A6" }}>· {f.identity_label.replace("_", " ")}</span><span className="block text-[#6E6E73] truncate">{[f.website, f.phone_e164, [f.city, f.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}{!f.accepted && f.quality_flags.length ? ` · dropped: ${f.quality_flags.map((x) => x.replace(/_/g, " ")).join(", ")}` : ""}</span></span>
                    {f.task_id && <a href="/team/tasks" className="shrink-0 text-[11px] text-[#0A84FF]">task</a>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
