"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SECTIONS, looksLikeSecret } from "@/lib/agency/onboarding";

export default function OnboardingForm({ initial, status }: { initial: Record<string, string>; status: string }) {
  const router = useRouter(); const [a, setA] = useState<Record<string, string>>(initial); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const locked = status === "submitted" || status === "approved";
  const warn = Object.values(a).some((v) => looksLikeSecret(v));
  async function send(submit: boolean) {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/portal/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers: a, submit }) }); const j = await r.json().catch(() => ({}));
    setBusy(false); if (!r.ok) { setMsg({ t: j.error || "That didn't work.", bad: true }); return; }
    setMsg({ t: submit ? "Submitted. Your agency will review it." : "Saved." }); router.refresh();
  }
  return (
    <div className="mt-8 flex flex-col gap-8">
      {SECTIONS.map((sec) => (
        <fieldset key={sec.title} disabled={locked || busy} className="mk-card p-7"><legend className="px-2 text-[19px] font-semibold">{sec.title}</legend>
          <div className="grid gap-4 mt-3">{sec.fields.map((f) => (
            <label key={f.key} className="flex flex-col gap-1.5 text-[13.5px]" style={{ color: "var(--mk-muted)" }}><span>{f.label}{f.required ? " *" : ""}</span>
              {f.long ? <textarea className="mk-input" style={{ height: 96, padding: 12 }} maxLength={f.max} placeholder={f.hint} value={a[f.key] ?? ""} onChange={(e) => setA({ ...a, [f.key]: e.target.value })} />
                : <input className="mk-input" maxLength={f.max} placeholder={f.hint} value={a[f.key] ?? ""} onChange={(e) => setA({ ...a, [f.key]: e.target.value })} />}
            </label>))}</div>
        </fieldset>))}
      {warn && <div role="alert" className="text-[13.5px]" style={{ color: "var(--mk-blue2)" }}>One of your answers looks like it may contain a password or key. Please remove it; we will connect your tools through secure links instead.</div>}
      {locked ? <p className="text-[14px]" style={{ color: "var(--mk-muted)" }}>{status === "approved" ? "This onboarding is approved." : "This is submitted and waiting for review, so it can't be edited right now."}</p> : (
        <div className="flex gap-3 flex-wrap"><button disabled={busy} onClick={() => void send(false)} className="mk-btn mk-btn-ghost">Save draft</button><button disabled={busy || warn} onClick={() => void send(true)} className="mk-btn mk-btn-primary">Submit for review</button></div>)}
      {msg && <div role="status" className="text-[14px]" style={{ color: msg.bad ? "var(--mk-blue2)" : "var(--mk-muted)" }}>{msg.t}</div>}
    </div>
  );
}
