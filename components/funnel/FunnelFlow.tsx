"use client";

import { useEffect, useRef, useState } from "react";
import { trackMarketingEvent } from "@/lib/marketingEvents";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import PricingTiers from "@/components/pricing/PricingTiers";
import BookDemoCall from "@/components/demo/BookDemoCall";

// The gated funnel. The SERVER decides the stage (see app/start/page.tsx);
// this component renders it and advances by reloading, so no step can be
// skipped from the client. Price appears only at stage "pricing".
export type Stage = "account" | "verify" | "build" | "pricing";
type Facts = { url: string; domain: string; name: string | null; logoUrl: string | null; category: string | null; nicheTags: string[]; city: string | null; state: string | null; services: string[]; offerLine: string | null; toneNotes: string[]; socials: Record<string, string>; phone: string | null; parked: boolean; reachable: boolean; reason: string | null };
type Props = { stage: Stage; email: string | null; name: string | null; phone: string | null; website: string | null; prefillSite?: string | null };
const field: React.CSSProperties = { background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.12)", color: "#F5F5F7" };
const label = "text-[11px] uppercase tracking-[0.14em] text-white/[0.45] font-semibold";
const STEPS: { key: Stage; n: number; title: string }[] = [{ key: "account", n: 1, title: "Create account" }, { key: "verify", n: 2, title: "Verify email" }, { key: "build", n: 3, title: "Your agent builds itself" }, { key: "pricing", n: 4, title: "Finish onboarding" }];

export default function FunnelFlow(p: Props) {
  const current = STEPS.find((s) => s.key === p.stage)!;
  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.14em]">
        {STEPS.map((s) => <li key={s.key} className={s.n < current.n ? "text-[#30D158]" : s.n === current.n ? "text-white" : "text-white/[0.3]"}>{s.n < current.n ? "✓ " : `${s.n}. `}{s.title}</li>)}
      </ol>
      <div className="rounded-[18px] p-7 md:p-9" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
        {p.stage === "account" && <AccountStep prefillSite={p.prefillSite ?? null} />}
        {p.stage === "verify" && <VerifyStep email={p.email ?? ""} />}
        {p.stage === "build" && <BuildStep website={p.website ?? ""} name={p.name ?? ""} phone={p.phone ?? ""} />}
        {p.stage === "pricing" && <PricingStep />}
      </div>
    </div>
  );
}

function AccountStep({ prefillSite }: { prefillSite: string | null }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", website: prefillSite ?? "", password: "" });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => { trackMarketingEvent("funnel_account_start", {}); }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const r = await fetch("/api/funnel/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
      const j = (await r.json()) as { ok?: boolean; email?: string; error?: string; signIn?: boolean; signedIn?: boolean; cid?: string };
      if (!r.ok) { setError(j.error || "Could not create your account."); if (j.signIn) setError(`${j.error} `); return; }
      if (!j.signedIn) {
        // The server could not issue the session on its response; try once from the browser before saying anything.
        const { error: sErr } = await createSupabaseBrowserClient().auth.signInWithPassword({ email: j.email ?? f.email, password: f.password });
        if (sErr) { setError(`Your account was created, but we couldn't sign you in automatically (ref ${j.cid ?? "—"}). Press the button again to continue — your details are kept.`); return; }
      }
      trackMarketingEvent("funnel_account_created", {});
      window.location.href = "/start";
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create your account."); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#30D158]">Step 1 of 4 · Create your account</div>
      <h1 className="text-[28px] md:text-[36px] font-bold tracking-[-0.03em] leading-[1.05]">Meet the agent that will run your growth.</h1>
      <p className="text-[14px] text-white/[0.55]">Four short steps: your details, a quick email check, then your agent reads your website and builds its own profile of your business. Nothing goes out without your approval.</p>
      <div className="grid sm:grid-cols-2 gap-3 mt-1">
        <input required minLength={2} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Your name" autoComplete="name" className="h-[46px] rounded-[9px] px-3 text-[15px] outline-none" style={field} />
        <input required type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="Work email" autoComplete="email" className="h-[46px] rounded-[9px] px-3 text-[15px] outline-none" style={field} />
        <input required value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Phone" inputMode="tel" autoComplete="tel" className="h-[46px] rounded-[9px] px-3 text-[15px] outline-none" style={field} />
        <input required value={f.website} onChange={(e) => set("website", e.target.value)} placeholder="Business website" inputMode="url" autoCapitalize="none" className="h-[46px] rounded-[9px] px-3 text-[15px] outline-none" style={field} />
      </div>
      <input required type="password" minLength={8} autoComplete="new-password" value={f.password} onChange={(e) => set("password", e.target.value)} placeholder="Create a password (8+ characters)" className="h-[46px] rounded-[9px] px-3 text-[15px] outline-none" style={field} />
      {error && <div className="text-[12.5px] text-[#FF9F9A]">{error}{/Sign in/.test(error) && <a href="/login?next=%2Fstart" className="underline">Sign in →</a>}</div>}
      <button type="submit" disabled={busy} className="mt-2 h-[48px] rounded-full bg-white text-black text-[15px] font-semibold disabled:opacity-50">{busy ? "Creating your account…" : "Continue →"}</button>
      <div className="text-[11px] text-white/[0.35]">Already have an account? <a href="/login?next=%2Fstart" className="underline">Sign in</a>.</div>
    </form>
  );
}

function VerifyStep({ email }: { email: string }) {
  const [code, setCode] = useState(""); const [cooldown, setCooldown] = useState(60); const [resends, setResends] = useState(0);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown((c) => c - 1), 1000); return () => clearTimeout(t); }, [cooldown]);
  const verify = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const r = await fetch("/api/funnel/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
      const j = (await r.json()) as { ok?: boolean; error?: string; restart?: boolean };
      if (!r.ok) { setError(j.error || "That code isn't right."); if (j.restart) window.location.href = "/start"; return; }
      trackMarketingEvent("funnel_verified", {}); window.location.href = "/start";
    } catch (err) { setError(err instanceof Error ? err.message : "Verification failed."); } finally { setBusy(false); }
  };
  const resend = async () => {
    setError(null); const r = await fetch("/api/funnel/verify", { method: "PUT" }); const j = (await r.json()) as { ok?: boolean; error?: string; retryInSec?: number | null; already?: boolean };
    if (j.already) { window.location.href = "/start"; return; }
    if (!r.ok) { setError(j.error || "Couldn't resend."); if (j.retryInSec) setCooldown(j.retryInSec); return; }
    setResends((n) => n + 1); setCooldown(60);
  };
  return (
    <form onSubmit={verify} className="flex flex-col gap-3">
      <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#30D158]">Step 2 of 4 · Verify your email</div>
      <h2 className="text-[26px] font-bold tracking-[-0.03em]">We sent a 6-digit code to {email}.</h2>
      <p className="text-[14px] text-white/[0.55]">It expires in 10 minutes. This is how we know your agent is talking to the right person.</p>
      <input autoFocus inputMode="numeric" pattern="[0-9]*" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" className="h-[56px] rounded-[9px] px-3 text-[26px] tracking-[0.4em] text-center outline-none" style={field} />
      {error && <div className="text-[12.5px] text-[#FF9F9A]">{error}</div>}
      <button type="submit" disabled={busy || code.length !== 6} className="h-[48px] rounded-full bg-white text-black text-[15px] font-semibold disabled:opacity-50">{busy ? "Verifying…" : "Verify →"}</button>
      <div className="text-[12px] text-white/[0.45]">Didn&apos;t get it? Check spam. {resends >= 3 ? "Resend limit reached." : cooldown > 0 ? `Resend in ${cooldown}s.` : <button type="button" onClick={resend} className="underline text-white/[0.8]">Resend code</button>} · <a href="/login?next=%2Fstart" className="underline text-white/[0.6]">Wrong email? Start over</a></div>
    </form>
  );
}

function BuildStep({ website, name, phone }: { website: string; name: string; phone: string }) {
  const [phase, setPhase] = useState<"idle" | "building" | "review">("idle");
  const [steps, setSteps] = useState<string[]>([]); const [facts, setFacts] = useState<Facts | null>(null); const [buildId, setBuildId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [businessName, setBusinessName] = useState(""); const [contactName, setContactName] = useState(name); const [category, setCategory] = useState(""); const [nicheTags, setNicheTags] = useState<string[]>([]); const [newTag, setNewTag] = useState("");
  const [city, setCity] = useState(""); const [state, setState] = useState(""); const [phoneV, setPhoneV] = useState(phone); const [offerLine, setOfferLine] = useState(""); const [services, setServices] = useState<string[]>([]); const [newService, setNewService] = useState(""); const [socials, setSocials] = useState<Record<string, string>>({});
  const feedRef = useRef<HTMLDivElement>(null);
  useEffect(() => { feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight }); }, [steps]);

  const build = async () => {
    setError(null); setSteps([]); setFacts(null); setPhase("building"); setBusy(true);
    try {
      const r = await fetch("/api/demo/build", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: website }) }); // email comes from the session server-side
      if (!r.ok || !r.body) { const j = await r.json().catch(() => ({})); throw new Error(j.error || "Couldn't start the build."); }
      const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = ""; let done: Facts | null = null;
      for (;;) {
        const { value, done: end } = await reader.read(); if (end) break;
        buf += dec.decode(value, { stream: true }); let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1); if (!line) continue;
          const ev = JSON.parse(line) as { type: string; text?: string; message?: string; facts?: Facts; buildId?: string | null };
          if (ev.type === "step" && ev.text) setSteps((s) => [...s, ev.text!]);
          if (ev.type === "error" && ev.message) setError(ev.message);
          if (ev.type === "done" && ev.facts) { done = ev.facts; setBuildId(ev.buildId ?? null); }
        }
      }
      if (!done || !done.reachable || done.parked) { setPhase("idle"); if (done?.reason) setError(done.reason); return; }
      setFacts(done); setBusinessName(done.name ?? ""); setCategory(done.category ?? ""); setNicheTags(done.nicheTags ?? []); setCity(done.city ?? ""); setState(done.state ?? ""); if (!phoneV && done.phone) setPhoneV(done.phone); setOfferLine(done.offerLine ?? ""); setServices(done.services); setSocials(done.socials);
      trackMarketingEvent("funnel_build_complete", { domain: done.domain });
      await new Promise((res) => setTimeout(res, 600)); setPhase("review");
    } catch (err) { setError(err instanceof Error ? err.message : "Couldn't build the profile."); setPhase("idle"); } finally { setBusy(false); }
  };
  useEffect(() => { void build(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const r = await fetch("/api/funnel/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ buildId, businessName, contactName, category, nicheTags, city, state, phone: phoneV, offerLine, services, socials, logoUrl: facts?.logoUrl ?? null, toneNotes: facts?.toneNotes ?? [] }) });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok) { setError(j.error || "Could not save."); return; }
      trackMarketingEvent("funnel_profile_saved", {}); window.location.href = "/start";
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save."); } finally { setBusy(false); }
  };

  if (phase !== "review") return (
    <div className="flex flex-col gap-4">
      <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#30D158]">Step 3 of 4 · Your agent builds itself</div>
      <h2 className="text-[24px] font-bold tracking-[-0.03em]">Reading {website.replace(/^https?:\/\//, "")}…</h2>
      <div ref={feedRef} className="rounded-[12px] p-4 h-[260px] overflow-y-auto font-mono text-[13px] leading-[1.7]" style={{ background: "#050505", border: "1px solid rgba(255,255,255,0.08)" }}>
        {steps.map((s, i) => <div key={i} className={i === steps.length - 1 ? "text-white" : "text-white/[0.55]"}><span className="text-[#30D158]">›</span> {s}</div>)}
        {phase === "building" && <div className="text-white/[0.35] animate-pulse">▌</div>}
      </div>
      {error && <div className="text-[12.5px] text-[#FF9F9A]">{error}</div>}
      {phase === "idle" && <button type="button" onClick={() => void build()} disabled={busy} className="self-start h-[44px] px-5 rounded-full bg-white text-black text-[14px] font-semibold disabled:opacity-50">Try again</button>}
    </div>
  );
  const f = facts!;
  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#30D158]">Step 3 of 4 · Here&apos;s what your agent learned</div>
      <div className="flex items-center gap-3">
        {f.logoUrl ? <img src={f.logoUrl} alt="" className="w-12 h-12 rounded-[10px] object-contain bg-white/[0.06] p-1" /> : <div className="w-12 h-12 rounded-[10px] bg-white/[0.06] flex items-center justify-center text-[18px] font-bold">{(businessName || f.domain)[0]?.toUpperCase()}</div>}
        <div><h2 className="text-[22px] font-bold tracking-[-0.03em] leading-tight">{businessName || f.domain}</h2><div className="text-[12px] text-white/[0.45]">{f.domain}{f.logoUrl ? "" : " · no clean logo found — add one from your dashboard"}</div></div>
      </div>
      <p className="text-[13px] text-white/[0.55]">Correct anything that&apos;s off. This is what your agent will work from.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><div className={label}>Business name</div><input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="h-[42px] w-full rounded-[9px] px-3 text-[14px] outline-none mt-1" style={field} /></div>
        <div><div className={label}>Your name (signs the emails)</div><input required value={contactName} onChange={(e) => setContactName(e.target.value)} className="h-[42px] w-full rounded-[9px] px-3 text-[14px] outline-none mt-1" style={field} /></div>
        <div><div className={label}>Niche — confirm or correct</div><input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={f.category ? undefined : "We couldn't tell — type it (e.g. roofing, coaching)"} className="h-[42px] w-full rounded-[9px] px-3 text-[14px] outline-none mt-1" style={{ ...field, borderColor: category ? "rgba(255,255,255,0.12)" : "rgba(255,159,10,0.6)" }} />
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px] text-white/[0.45]">Also:{nicheTags.map((t) => <span key={t} className="inline-flex items-center gap-1 px-2 h-[22px] rounded-full text-white/[0.75]" style={{ border: "1px solid rgba(255,255,255,0.12)" }}>{t}<button type="button" onClick={() => setNicheTags(nicheTags.filter((x) => x !== t))} className="text-white/[0.35] hover:text-white">×</button></span>)}<input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const t = newTag.trim().toLowerCase(); if (t && !nicheTags.includes(t) && nicheTags.length < 4) setNicheTags([...nicheTags, t]); setNewTag(""); } }} placeholder="add a tag" className="h-[22px] rounded-full px-2 text-[11px] outline-none w-[90px]" style={field} /></div></div>
        <div className="grid grid-cols-[1fr_72px] gap-2"><div><div className={label}>City</div><input value={city} onChange={(e) => setCity(e.target.value)} className="h-[42px] w-full rounded-[9px] px-3 text-[14px] outline-none mt-1" style={field} /></div><div><div className={label}>State</div><input value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} placeholder="OK" className="h-[42px] w-full rounded-[9px] px-3 text-[14px] outline-none mt-1" style={field} /></div></div>
        <div><div className={label}>Phone</div><input required value={phoneV} onChange={(e) => setPhoneV(e.target.value)} inputMode="tel" className="h-[42px] w-full rounded-[9px] px-3 text-[14px] outline-none mt-1" style={field} /></div>
        <div><div className={label}>Website</div><input value={f.url} readOnly className="h-[42px] w-full rounded-[9px] px-3 text-[14px] outline-none mt-1 text-white/[0.5]" style={field} /></div>
      </div>
      <div><div className={label}>Your one-line offer (every intro uses it)</div><textarea required value={offerLine} onChange={(e) => setOfferLine(e.target.value.slice(0, 180))} rows={2} placeholder="What you do, for whom, and the one reason to reply." className="w-full rounded-[9px] px-3 py-2 text-[14px] outline-none mt-1" style={field} /><div className="text-[11px] text-white/[0.35] text-right">{offerLine.length}/180</div></div>
      <div><div className={label}>Services</div>
        <div className="flex flex-wrap gap-2 mt-2">{services.map((s) => <span key={s} className="inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full text-[12.5px]" style={{ background: "#151515", border: "1px solid rgba(255,255,255,0.12)" }}>{s}<button type="button" onClick={() => setServices(services.filter((x) => x !== s))} className="text-white/[0.4] hover:text-white">×</button></span>)}<input value={newService} onChange={(e) => setNewService(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (newService.trim()) { setServices(Array.from(new Set([...services, newService.trim()]))); setNewService(""); } } }} placeholder="Add a service" className="h-[30px] rounded-full px-3 text-[12.5px] outline-none" style={field} /></div>
        {services.length === 0 && <div className="text-[12px] text-white/[0.4] mt-1">Nothing listed on your homepage — add what you sell.</div>}</div>
      {f.toneNotes.length > 0 && <div><div className={label}>Writing style noticed on your site</div><div className="flex flex-wrap gap-2 mt-2">{f.toneNotes.map((n) => <span key={n} className="h-[28px] inline-flex items-center px-3 rounded-full text-[12px] text-white/[0.75]" style={{ border: "1px solid rgba(48,209,88,0.3)", background: "rgba(48,209,88,0.08)" }}>{n}</span>)}</div></div>}
      {Object.keys(socials).length > 0 && <div><div className={label}>Social profiles</div><div className="flex flex-wrap gap-2 mt-2">{Object.entries(socials).map(([k, v]) => <span key={k} className="inline-flex items-center gap-1.5 h-[28px] px-3 rounded-full text-[12px] text-white/[0.75]" style={{ border: "1px solid rgba(255,255,255,0.12)" }}>{k}<button type="button" onClick={() => { const n = { ...socials }; delete n[k]; setSocials(n); }} className="text-white/[0.4] hover:text-white" title={v}>×</button></span>)}</div></div>}
      {error && <div className="text-[12.5px] text-[#FF9F9A]">{error}</div>}
      <div className="flex gap-2 mt-1"><button type="button" onClick={() => void build()} className="h-[46px] px-5 rounded-full text-[14px]" style={{ border: "1px solid rgba(255,255,255,0.16)" }}>Rebuild</button><button type="submit" disabled={busy} className="flex-1 h-[46px] rounded-full bg-white text-black text-[14px] font-semibold disabled:opacity-50">{busy ? "Saving…" : "Looks right — continue →"}</button></div>
    </form>
  );
}

function PricingStep() {
  useEffect(() => { trackMarketingEvent("funnel_pricing_seen", {}); }, []);
  return (
    <div className="flex flex-col gap-4">
      <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#30D158]">Step 4 of 4 · Finish onboarding</div>
      <h2 className="text-[26px] md:text-[32px] font-bold tracking-[-0.03em]">Your agent is built. Put it to work.</h2>
      <p className="text-[14px] text-white/[0.55]">Pick a plan to finish onboarding and unlock your dashboard. One monthly, one setup. Cancel anytime.</p>
      <PricingTiers funnel />
      <div className="flex flex-wrap items-center gap-3 text-[13px] text-white/[0.55]">Prefer to talk it through first? <BookDemoCall source="funnel_pricing" compact /></div>
    </div>
  );
}
