"use client";

import { useEffect, useRef, useState } from "react";
import type { BusinessProfile } from "@/lib/onboarding/state";

const input = "w-full h-[42px] rounded-lg border border-neutral-300 px-3 text-[14px] outline-none focus:border-neutral-900";
const label = "text-[12px] font-medium text-neutral-600 mb-1 block";

/** Step 1 — confirm/correct what the build show extracted. Nothing is redone after this. */
export default function StepProfile({ business: b, draft, onSave, onConfirm }: { business: BusinessProfile; draft: Record<string, unknown> | null; onSave: (d: Record<string, unknown>) => void; onConfirm: (d: Record<string, unknown>) => Promise<void> }) {
  const d = (k: string) => (draft && typeof draft[k] === "string" ? (draft[k] as string) : null);
  const list = (k: string, fallback: string[] | null) => (draft && Array.isArray(draft[k]) ? (draft[k] as string[]).join(", ") : (fallback ?? []).join(", "));
  const [f, setF] = useState({
    businessName: d("businessName") ?? b.legal_name ?? "", website: d("website") ?? b.website ?? "", category: d("category") ?? b.primary_category ?? "",
    nicheTags: list("nicheTags", b.niche_tags), city: d("city") ?? b.city ?? "", state: d("state") ?? b.state ?? "", phone: d("phone") ?? b.phone ?? "",
    services: list("services", b.services), offerLine: d("offerLine") ?? b.outbound_offer_line ?? "", description: d("description") ?? b.description ?? "",
  });
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const payload = () => ({ ...f, nicheTags: f.nicheTags.split(",").map((s) => s.trim()).filter(Boolean), services: f.services.split(",").map((s) => s.trim()).filter(Boolean) });
  // Draft autosave (debounced) so a mid-step exit resumes with the inputs intact.
  useEffect(() => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => onSave(payload()), 800); return () => { if (timer.current) clearTimeout(timer.current); }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); await onConfirm(payload()); setBusy(false); }} className="border border-neutral-200 rounded-2xl p-6 flex flex-col gap-4">
      <p className="text-[13.5px] text-neutral-600">This is what your agent believes about your business, pulled from your website during signup. Fix anything that&apos;s off — every message and every search your agent makes starts from here.</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><label className={label}>Business name</label><input className={input} value={f.businessName} onChange={set("businessName")} required /></div>
        <div><label className={label}>Website</label><input className={input} value={f.website} onChange={set("website")} placeholder="https://" /></div>
        <div><label className={label}>What you do (category)</label><input className={input} value={f.category} onChange={set("category")} placeholder="e.g. roofing contractor" /></div>
        <div><label className={label}>Niche tags <span className="text-neutral-400 font-normal">(comma-separated, up to 5)</span></label><input className={input} value={f.nicheTags} onChange={set("nicheTags")} placeholder="storm damage, commercial" /></div>
        <div><label className={label}>City</label><input className={input} value={f.city} onChange={set("city")} /></div>
        <div><label className={label}>State</label><input className={input} value={f.state} onChange={set("state")} maxLength={2} placeholder="TX" /></div>
        <div><label className={label}>Phone</label><input className={input} value={f.phone} onChange={set("phone")} inputMode="tel" /></div>
        <div><label className={label}>Services <span className="text-neutral-400 font-normal">(comma-separated)</span></label><input className={input} value={f.services} onChange={set("services")} /></div>
      </div>
      <div><label className={label}>Your one-line offer <span className="text-neutral-400 font-normal">— the sentence every intro email uses</span></label><input className={input} value={f.offerLine} onChange={set("offerLine")} placeholder="We replace storm-damaged roofs in 48 hours, insurance handled." /></div>
      <div><label className={label}>About the business <span className="text-neutral-400 font-normal">(optional)</span></label><textarea className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-[14px] outline-none focus:border-neutral-900 min-h-[80px]" value={f.description} onChange={set("description")} /></div>
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={busy} className="h-[44px] px-6 rounded-full bg-neutral-900 text-white text-[14px] font-semibold disabled:opacity-60">{busy ? "Saving…" : "Looks right — continue"}</button>
        <span className="text-[12.5px] text-neutral-400">Saves as you type.</span>
      </div>
    </form>
  );
}
