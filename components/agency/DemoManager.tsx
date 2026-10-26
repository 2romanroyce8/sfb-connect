"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Demo = { id: string; slug: string; business_name: string; industry_key: string | null; status: string; created_at: string; opens?: number; actions?: number };
export default function DemoManager({ initial, packs, agencySlug }: { initial: Demo[]; packs: { key: string; name: string }[]; agencySlug: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const link = (d: Demo) => `${typeof window === "undefined" ? "" : window.location.origin}/d/${agencySlug}/${d.slug}`;
  const router = useRouter();
  const [name, setName] = useState(""); const [site, setSite] = useState(""); const [industry, setIndustry] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const input = "h-[38px] rounded-[8px] px-3 text-[13px] outline-none w-full";
  const st = { background: "var(--hx-111111)", border: "1px solid rgb(var(--w) / 0.1)", color: "var(--hx-f5f5f7)" };
  async function call(body: Record<string, unknown>) {
    setBusy(true); setErr(null);
    try { const r = await fetch("/api/app/demos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "That didn't work."); setName(""); setSite(""); router.refresh(); }
    catch (e) { setErr(e instanceof Error ? e.message : "That didn't work."); } finally { setBusy(false); }
  }
  return (
    <div className="mt-5">
      <div className="rounded-[14px] p-5 grid gap-3 md:grid-cols-4" style={{ background: "var(--hx-111111)", border: "1px solid rgb(var(--w) / 0.07)" }}>
        <input className={input} style={st} placeholder="Business name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={input} style={st} placeholder="Website (optional)" value={site} onChange={(e) => setSite(e.target.value)} />
        <select className={input} style={st} value={industry} onChange={(e) => setIndustry(e.target.value)}><option value="">Industry (optional)</option>{packs.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select>
        <button disabled={busy || name.trim().length < 2} onClick={() => void call({ action: "create", business_name: name, website_url: site, industry_key: industry })} className="h-[38px] rounded-[8px] bg-white text-black text-[12.5px] font-semibold disabled:opacity-40">Create demo</button>
      </div>
      {err && <div role="alert" className="mt-3 text-[13px]" style={{ color: "var(--hx-ff453a)" }}>{err}</div>}
      <div className="mt-5 flex flex-col gap-2">
        {initial.length === 0 && <div className="text-[13px] text-[color:var(--hx-6e6e73)]">No demos yet. Create the first one above.</div>}
        {initial.map((d) => (
          <div key={d.id} className="rounded-[12px] px-4 py-3 flex items-center gap-3" style={{ background: "var(--hx-111111)", border: "1px solid rgb(var(--w) / 0.07)" }}>
            <div className="min-w-0 mr-auto"><div className="text-[14px] font-medium truncate">{d.business_name}</div><div className="text-[11.5px] text-[color:var(--hx-6e6e73)]">/d/{agencySlug}/{d.slug} · {d.industry_key ?? "general"} · {d.status}{d.status === "published" ? ` · ${d.opens ?? 0} opens · ${d.actions ?? 0} interactions` : ""}</div></div>
            {d.status === "published" && <><a href={`/d/${agencySlug}/${d.slug}`} target="_blank" rel="noopener noreferrer" className="h-[32px] px-3 rounded-full text-[12px] font-semibold inline-flex items-center" style={{ border: "1px solid rgb(var(--w) / 0.14)" }}>Open</a><button type="button" onClick={() => { void navigator.clipboard.writeText(link(d)); setCopied(d.id); window.setTimeout(() => setCopied(null), 1800); }} className="h-[32px] px-3 rounded-full text-[12px] font-semibold" style={{ border: "1px solid rgb(var(--w) / 0.14)" }}>{copied === d.id ? "Copied" : "Copy link"}</button></>}
            <button disabled={busy} onClick={() => void call({ action: d.status === "published" ? "unpublish" : "publish", id: d.id })} className="h-[32px] px-3 rounded-full text-[12px] font-semibold" style={{ border: "1px solid rgb(var(--w) / 0.14)" }}>{d.status === "published" ? "Unpublish" : "Publish"}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
