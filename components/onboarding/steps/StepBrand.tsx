"use client";

import { useRef, useState } from "react";
import type { BusinessProfile } from "@/lib/onboarding/state";

/** Step 4 — logo + colors: auto-pulled from the site, upload as the fallback. */
export default function StepBrand({ business: b, onConfirm }: { business: BusinessProfile; onConfirm: () => Promise<void> }) {
  const [logo, setLogo] = useState<string | null>(b.brand_logo_url);
  const [colors, setColors] = useState<string[]>(b.brand_colors ?? []);
  const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pull = async () => {
    setBusy("pull"); setMsg(null);
    try { const r = await fetch("/api/dashboard/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "brand_pull" }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); if (j.logoUrl) setLogo(j.logoUrl); setColors(j.colors ?? []); setMsg(j.note ?? `Pulled from ${b.website}.`); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Couldn't read the site."); } finally { setBusy(null); }
  };
  const upload = async (file: File) => {
    setBusy("upload"); setMsg(null);
    try { const fd = new FormData(); fd.append("file", file); const r = await fetch("/api/dashboard/onboarding/logo", { method: "POST", body: fd }); const j = await r.json(); if (!r.ok) throw new Error(j.error); setLogo(j.logoUrl); setMsg("Logo uploaded."); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Upload failed."); } finally { setBusy(null); }
  };
  const saveColors = async (next: string[]) => { setColors(next); await fetch("/api/dashboard/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "brand_colors", colors: next }) }); };

  return (
    <div className="border border-neutral-200 rounded-2xl p-6 flex flex-col gap-5">
      <p className="text-[13.5px] text-neutral-600">Your logo and colors show up on your dashboard and anywhere your agent represents you. We pull them from your website; if the site doesn&apos;t expose a clean logo, upload one.</p>
      <div className="flex items-start gap-5 flex-wrap">
        <div className="w-[140px] h-[140px] rounded-xl border border-neutral-200 bg-neutral-50 grid place-items-center overflow-hidden">{logo ? <img src={logo} alt="Logo" className="max-w-[120px] max-h-[120px] object-contain" /> : <span className="text-[12px] text-neutral-400 text-center px-3">No logo yet</span>}</div>
        <div className="flex flex-col gap-2">
          <button onClick={pull} disabled={!!busy || !b.website} className="h-[40px] px-4 rounded-full border border-neutral-300 text-[13.5px] font-medium disabled:opacity-50">{busy === "pull" ? "Reading your site…" : `Pull from ${b.website ? new URL(b.website).hostname : "your website"}`}</button>
          <button onClick={() => fileRef.current?.click()} disabled={!!busy} className="h-[40px] px-4 rounded-full border border-neutral-300 text-[13.5px] font-medium disabled:opacity-50">{busy === "upload" ? "Uploading…" : "Upload a logo"}</button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
          {msg && <div className="text-[12.5px] text-neutral-600">{msg}</div>}
        </div>
      </div>
      <div>
        <div className="text-[12px] font-medium text-neutral-600 mb-2">Brand colors</div>
        <div className="flex items-center gap-2 flex-wrap">
          {colors.map((c, i) => <label key={i} className="flex items-center gap-2 border border-neutral-200 rounded-full pl-1 pr-3 py-1 text-[12.5px]"><input type="color" value={c} onChange={(e) => { const n = [...colors]; n[i] = e.target.value.toLowerCase(); void saveColors(n); }} className="w-6 h-6 rounded-full border-0 p-0 bg-transparent" /><span className="font-mono">{c}</span><button type="button" onClick={() => void saveColors(colors.filter((_, j) => j !== i))} className="text-neutral-400">×</button></label>)}
          {colors.length < 4 && <button type="button" onClick={() => void saveColors([...colors, "var(--hx-0a84ff)"])} className="h-[32px] px-3 rounded-full border border-dashed border-neutral-300 text-[12.5px] text-neutral-500">+ add</button>}
        </div>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button onClick={async () => { setBusy("confirm"); await onConfirm(); setBusy(null); }} disabled={!!busy} className="h-[44px] px-6 rounded-full bg-neutral-900 text-white text-[14px] font-semibold disabled:opacity-60">{logo ? "Looks right — continue" : "Continue without a logo"}</button>
        <span className="text-[12.5px] text-neutral-400">You can change these later in Settings.</span>
      </div>
    </div>
  );
}
