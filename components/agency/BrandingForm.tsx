"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type B = { display_name: string; logo_url: string; primary_color: string; contact_email: string; website: string; booking_url: string };
const FIELDS: { k: keyof B; label: string; ph: string }[] = [
  { k: "display_name", label: "Agency name", ph: "Your agency" }, { k: "logo_url", label: "Logo link (https)", ph: "https://…/logo.png" }, { k: "primary_color", label: "Brand color", ph: "#RRGGBB" },
  { k: "contact_email", label: "Contact email", ph: "hello@youragency.com" }, { k: "website", label: "Website (https)", ph: "https://youragency.com" }, { k: "booking_url", label: "Booking link (https)", ph: "https://cal.com/you" },
];
export default function BrandingForm({ initial, canEdit }: { initial: B; canEdit: boolean }) {
  const router = useRouter(); const [v, setV] = useState(initial); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const r = await fetch("/api/app/branding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v) }); const j = await r.json().catch(() => ({}));
    setBusy(false); if (!r.ok) { setMsg({ t: j.error || "That didn't work.", bad: true }); return; } setMsg({ t: "Saved." }); router.refresh();
  }
  const st = { background: "var(--hx-111111)", border: "1px solid rgb(var(--w) / 0.1)", color: "var(--hx-f5f5f7)" };
  return (
    <form onSubmit={save} className="mt-5 rounded-[14px] p-5 grid gap-4 md:grid-cols-2" style={{ background: "var(--hx-111111)", border: "1px solid rgb(var(--w) / 0.07)" }}>
      {FIELDS.map((f) => <label key={f.k} className="flex flex-col gap-1.5 text-[12.5px] text-[color:var(--hx-a1a1a6)]">{f.label}<input disabled={!canEdit} value={v[f.k]} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} placeholder={f.ph} className="h-[38px] rounded-[8px] px-3 text-[13px] outline-none disabled:opacity-60" style={st} /></label>)}
      <div className="md:col-span-2 flex items-center gap-3">
        <button disabled={busy || !canEdit} className="h-[38px] px-5 rounded-[8px] bg-white text-black text-[12.5px] font-semibold disabled:opacity-40">{busy ? "Saving…" : "Save branding"}</button>
        {!canEdit && <span className="text-[12px] text-[color:var(--hx-6e6e73)]">Only an owner or admin can change branding.</span>}
        {msg && <span role="status" className="text-[12.5px]" style={{ color: msg.bad ? "var(--hx-ff453a)" : "var(--hx-30d158)" }}>{msg.t}</span>}
      </div>
    </form>
  );
}
