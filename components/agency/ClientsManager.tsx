"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SECTIONS } from "@/lib/agency/onboarding";

type Row = { id: string; name: string; website: string | null; status: string; joined: boolean; onboarding: string; answers: Record<string, string>; note: string | null };
const LABEL: Record<string, string> = { draft: "Onboarding not submitted", submitted: "Submitted — needs review", changes_requested: "Changes requested", approved: "Approved" };
const inp = "h-[36px] rounded-[8px] px-3 text-[13px] outline-none w-full"; const st = { background: "var(--hx-111111)", border: "1px solid rgb(var(--w) / 0.1)", color: "var(--hx-f5f5f7)" };

export default function ClientsManager({ rows, canManage }: { rows: Row[]; canManage: boolean }) {
  const router = useRouter(); const [name, setName] = useState(""); const [site, setSite] = useState(""); const [busy, setBusy] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null); const [email, setEmail] = useState(""); const [link, setLink] = useState<{ id: string; url: string } | null>(null); const [note, setNote] = useState(""); const [copied, setCopied] = useState(false);
  async function call(key: string, body: Record<string, unknown>) {
    setBusy(key); setErr(null);
    try { const r = await fetch("/api/app/clients", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "That didn't work."); router.refresh(); return j; }
    catch (e) { setErr(e instanceof Error ? e.message : "That didn't work."); return null; } finally { setBusy(null); }
  }
  return (
    <div className="mt-5">
      {canManage && <div className="rounded-[14px] p-5 grid gap-3 md:grid-cols-[1fr_1fr_auto] mb-5" style={{ background: "var(--hx-111111)", border: "1px solid rgb(var(--w) / 0.07)" }}>
        <input className={inp} style={st} placeholder="Client business name" aria-label="Client business name" value={name} onChange={(e) => setName(e.target.value)} /><input className={inp} style={st} placeholder="Website (optional)" aria-label="Website" value={site} onChange={(e) => setSite(e.target.value)} />
        <button disabled={busy !== null || name.trim().length < 2} onClick={async () => { if (await call("create", { action: "create", name, website: site })) { setName(""); setSite(""); } }} className="h-[36px] px-5 rounded-[8px] bg-white text-black text-[12.5px] font-semibold disabled:opacity-40">Add client</button></div>}
      {err && <div role="alert" className="mb-3 text-[13px]" style={{ color: "var(--hx-ff453a)" }}>{err}</div>}
      {rows.length === 0 && <div className="text-[13px] text-[color:var(--hx-6e6e73)]">No clients yet. Add your first client above.</div>}
      <div className="flex flex-col gap-3">{rows.map((c) => (
        <div key={c.id} className="rounded-[14px] p-4" style={{ background: "var(--hx-111111)", border: "1px solid rgb(var(--w) / 0.07)" }}>
          <div className="flex items-center gap-3 flex-wrap"><div className="mr-auto min-w-0"><div className="text-[15px] font-medium truncate">{c.name}</div><div className="text-[12px] text-[color:var(--hx-6e6e73)]">{c.website ?? "No website"} · {c.joined ? "Has portal access" : "Not invited yet"} · {LABEL[c.onboarding] ?? c.onboarding}</div></div>
            <button onClick={() => { setOpen(open === c.id ? null : c.id); setLink(null); setNote(""); setEmail(""); }} className="h-[32px] px-3 rounded-full text-[12px] font-semibold" style={{ border: "1px solid rgb(var(--w) / 0.14)" }}>{open === c.id ? "Close" : "Manage"}</button></div>
          {open === c.id && (
            <div className="mt-4 pt-4 grid gap-5 md:grid-cols-2" style={{ borderTop: "1px solid rgb(var(--w) / 0.07)" }}>
              <div><div className="text-[12px] uppercase tracking-wide text-[color:var(--hx-6e6e73)] mb-2">Invite to portal</div>
                <div className="flex gap-2"><input className={inp} style={st} placeholder="client@theirbusiness.com" aria-label="Client email" value={email} onChange={(e) => setEmail(e.target.value)} /><button disabled={busy !== null || !email.includes("@")} onClick={async () => { const j = await call("invite", { action: "invite", client_id: c.id, email }); if (j?.link) setLink({ id: c.id, url: j.link }); }} className="h-[36px] px-4 rounded-[8px] text-[12.5px] font-semibold disabled:opacity-40" style={{ border: "1px solid rgb(var(--w) / 0.14)" }}>Create link</button></div>
                {link?.id === c.id && <div className="mt-3 text-[12px]"><div className="break-all rounded-[8px] p-2.5" style={{ background: "var(--hx-0a0a0a)", border: "1px solid rgb(var(--w) / 0.1)" }}>{link.url}</div><button onClick={() => { void navigator.clipboard.writeText(link.url); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }} className="mt-2 h-[30px] px-3 rounded-full text-[12px] font-semibold" style={{ border: "1px solid rgb(var(--w) / 0.14)" }}>{copied ? "Copied" : "Copy link"}</button><div className="mt-1.5 text-[11.5px] text-[color:var(--hx-6e6e73)]">Works once, for 7 days, and only for that email address. Send it yourself.</div></div>}
              </div>
              <div><div className="text-[12px] uppercase tracking-wide text-[color:var(--hx-6e6e73)] mb-2">Onboarding answers</div>
                {Object.keys(c.answers).length === 0 ? <div className="text-[12.5px] text-[color:var(--hx-6e6e73)]">Nothing filled in yet.</div> : <div className="max-h-[260px] overflow-y-auto text-[12.5px] flex flex-col gap-2">{SECTIONS.flatMap((s) => s.fields).filter((f) => c.answers[f.key]).map((f) => <div key={f.key}><div className="text-[color:var(--hx-6e6e73)]">{f.label}</div><div className="whitespace-pre-wrap">{c.answers[f.key]}</div></div>)}</div>}
                {c.onboarding === "submitted" && canManage && <div className="mt-3"><textarea className="w-full rounded-[8px] p-2.5 text-[12.5px] outline-none min-h-[56px]" style={st} placeholder="If you need changes, say what to fix" value={note} onChange={(e) => setNote(e.target.value)} />
                  <div className="flex gap-2 mt-2"><button disabled={busy !== null} onClick={() => void call("approve", { action: "review", client_id: c.id, decision: "approve" })} className="h-[32px] px-4 rounded-[8px] bg-white text-black text-[12.5px] font-semibold disabled:opacity-40">Approve</button><button disabled={busy !== null || !note.trim()} onClick={async () => { if (await call("changes", { action: "review", client_id: c.id, decision: "changes", note })) setNote(""); }} className="h-[32px] px-4 rounded-[8px] text-[12.5px] font-semibold disabled:opacity-40" style={{ border: "1px solid rgb(var(--w) / 0.14)" }}>Request changes</button></div></div>}
                {c.note && c.onboarding === "changes_requested" && <div className="mt-2 text-[12px] text-[color:var(--hx-6e6e73)]">You asked: {c.note}</div>}
              </div>
            </div>)}
        </div>))}</div>
    </div>
  );
}
