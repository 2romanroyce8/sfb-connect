"use client";

import { useEffect, useState } from "react";
import type { BusinessProfile } from "@/lib/onboarding/state";
import { ICP_SIZES } from "@/lib/onboarding/icp";

const input = "w-full h-[42px] rounded-lg border border-neutral-300 px-3 text-[14px] outline-none focus:border-neutral-900";
const label = "text-[12px] font-medium text-neutral-600 mb-1 block";
type IcpForm = { industries: string; locations: string; size: string; notes: string };

/** Step 6 — guided ICP. Suggested from the category preset + the business's market; the user edits and saves. */
export default function StepIcp({ business, onDone }: { business: BusinessProfile; onDone: () => void }) {
  const [f, setF] = useState<IcpForm | null>(null); const [source, setSource] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { (async () => {
    const r = await fetch("/api/dashboard/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "icp_suggest" }) });
    const j = await r.json(); const icp = j.icp as { industries: string[]; locations: string[]; size: string; notes: string | null; source: string } | null;
    setF({ industries: icp?.industries.join(", ") ?? "", locations: icp?.locations.join(", ") ?? (business.city && business.state ? `${business.city}, ${business.state}` : ""), size: icp?.size ?? "any", notes: icp?.source === "user" ? icp.notes ?? "" : "" });
    setSource(icp?.source ?? null);
  })(); }, [business.city, business.state]);
  const set = (k: keyof IcpForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((x) => (x ? { ...x, [k]: e.target.value } : x));
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!f) return; setBusy(true); setErr(null);
    const r = await fetch("/api/dashboard/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "icp_save", data: { industries: f.industries, locations: f.locations, size: f.size, notes: f.notes } }) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) { setErr(j.error || "Could not save."); return; }
    onDone();
  };
  if (!f) return <div className="border border-neutral-200 rounded-2xl p-6 text-[13px] text-neutral-500">Loading…</div>;
  return (
    <form onSubmit={save} className="border border-neutral-200 rounded-2xl p-6 flex flex-col gap-4">
      <p className="text-[13.5px] text-neutral-600">Who do you want more of? Your lead list and every intro are built from this. {source === "preset" && <span className="text-neutral-500">We pre-filled a suggestion from what {business.primary_category ? `a ${business.primary_category}` : "a business like yours"} usually sells to — change anything.</span>}</p>
      <div><label className={label}>Kinds of business <span className="text-neutral-400 font-normal">(comma-separated, up to 6)</span></label><input className={input} value={f.industries} onChange={set("industries")} placeholder="property management company, HOA, general contractor" required /></div>
      <div><label className={label}>Where <span className="text-neutral-400 font-normal">(cities or areas, comma-separated)</span></label><input className={input} value={f.locations} onChange={set("locations")} placeholder="Tampa, FL, Orlando, FL" required /></div>
      <div><label className={label}>Size</label><select className={input} value={f.size} onChange={set("size")}>{ICP_SIZES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></div>
      <div><label className={label}>Anything else your agent should know <span className="text-neutral-400 font-normal">(optional)</span></label><textarea className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-[14px] outline-none focus:border-neutral-900 min-h-[70px]" value={f.notes} onChange={set("notes")} placeholder="e.g. commercial only, no residential" /></div>
      {err && <div className="text-[13px] text-red-600">{err}</div>}
      <div className="pt-1"><button type="submit" disabled={busy} className="h-[44px] px-6 rounded-full bg-neutral-900 text-white text-[14px] font-semibold disabled:opacity-60">{busy ? "Saving…" : "Save and find leads →"}</button></div>
    </form>
  );
}
