"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { slugify } from "@/lib/agency/slug";

export default function StartAgencyForm() {
  const router = useRouter(); const [name, setName] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const r = await fetch("/api/app/agency", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) }); const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error || "That didn't work."); setBusy(false); return; }
    router.push("/app"); router.refresh();
  }
  return (
    <form onSubmit={go} className="w-full max-w-[420px] rounded-[16px] p-7 flex flex-col gap-4" style={{ background: "var(--hx-111111)", border: "1px solid rgb(var(--w) / 0.08)" }}>
      <h1 className="text-[22px] font-semibold tracking-tight">Start your agency</h1>
      <p className="text-[13px] text-[color:var(--hx-a1a1a6)]">Name it. You can change branding any time.</p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Agency name" aria-label="Agency name" className="h-[42px] rounded-[8px] px-3 text-[14px] outline-none" style={{ background: "var(--hx-0a0a0a)", border: "1px solid rgb(var(--w) / 0.1)" }} />
      {name.trim().length >= 2 && <div className="text-[11.5px] text-[color:var(--hx-6e6e73)]">Your link: /{slugify(name)}</div>}
      {err && <div role="alert" className="text-[13px]" style={{ color: "var(--hx-ff453a)" }}>{err}</div>}
      <button disabled={busy || name.trim().length < 2} className="h-[42px] rounded-[8px] bg-white text-black text-[13px] font-semibold disabled:opacity-40">{busy ? "Creating…" : "Create agency"}</button>
    </form>
  );
}
