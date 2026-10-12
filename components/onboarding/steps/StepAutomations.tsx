"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CADENCES } from "@/lib/onboarding/automations";

type Preview = { day: number; template: string; subject: string; body: string }[];

/** Step 8 — follow-up sequence, pre-filled with the real templates rendered against this business. Every step still needs approval before it sends. */
export default function StepAutomations({ onDone }: { onDone: () => void }) {
  const [cad, setCad] = useState("steady"); const [preview, setPreview] = useState<Preview | null>(null);
  const [err, setErr] = useState<{ text: string; fix?: string } | null>(null); const [busy, setBusy] = useState(false);
  const load = useCallback(async (k: string) => {
    setErr(null);
    const r = await fetch("/api/dashboard/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "automations_preview", data: { cadence: k } }) });
    const j = await r.json(); if (!r.ok) { setErr({ text: j.error, fix: j.fix }); setPreview(null); return; } setPreview(j.preview);
  }, []);
  useEffect(() => { void load(cad); }, [cad, load]);
  const activate = async () => {
    setBusy(true); setErr(null);
    const r = await fetch("/api/dashboard/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "automations_activate", data: { cadence: cad } }) });
    const j = await r.json(); setBusy(false); if (!r.ok) { setErr({ text: j.error, fix: j.fix }); return; } onDone();
  };
  return (
    <div className="border border-neutral-200 rounded-2xl p-6 flex flex-col gap-4">
      <p className="text-[13.5px] text-neutral-600">When a campaign starts, each business gets this sequence. The wording is fixed and comes from your own profile — nothing is invented — and <strong className="text-neutral-800">every message waits for your approval</strong> before it leaves. Pick a pace.</p>
      <div className="grid sm:grid-cols-3 gap-2">{CADENCES.map((c) => <button key={c.key} onClick={() => setCad(c.key)} className={`text-left rounded-xl border p-3 ${cad === c.key ? "border-neutral-900 bg-neutral-50" : "border-neutral-200"}`}><div className="text-[13.5px] font-medium text-neutral-900">{c.label}</div><div className="text-[12px] text-neutral-500 mt-0.5">{c.hint}</div></button>)}</div>
      {err && <div className="text-[13px] text-red-600">{err.text} {err.fix && <Link href={err.fix} className="underline">Fix it</Link>}</div>}
      {preview && (
        <div className="flex flex-col gap-3">
          <div className="text-[12px] font-medium text-neutral-600">Preview, as a prospect would read it (sample business name):</div>
          {preview.map((p) => <div key={p.template} className="rounded-xl border border-neutral-200 p-4"><div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">Day {p.day} · {p.template.replace(/_/g, " ")}</div><div className="text-[13.5px] font-medium text-neutral-900 mt-1">{p.subject}</div><pre className="text-[12.5px] text-neutral-700 mt-2 whitespace-pre-wrap font-sans leading-relaxed">{p.body}</pre></div>)}
        </div>
      )}
      <div className="pt-1"><button onClick={activate} disabled={busy || !preview} className="h-[44px] px-6 rounded-full bg-neutral-900 text-white text-[14px] font-semibold disabled:opacity-60">{busy ? "Saving…" : "Use this sequence →"}</button></div>
    </div>
  );
}
