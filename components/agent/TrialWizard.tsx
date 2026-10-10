"use client";

import { useEffect, useState } from "react";
import { trackMarketingEvent } from "@/lib/marketingEvents";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { CAPABILITIES, STOCK_PROFILES, TIERS, bookedCallsFor } from "@/lib/agentProgram/config";

const trial = TIERS[0];
const field: React.CSSProperties = { background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.12)", color: "#F5F5F7" };

// Trial onboarding, steps 1-3 here (account -> stock business -> pick 3).
// Steps 4-5 (watch the agent work, approve the first 3 tasks) happen in the
// dashboard after sign-in.
export default function TrialWizard() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [prefilled, setPrefilled] = useState(false);
  const [scanDomain, setScanDomain] = useState<string | null>(null);
  // Arriving from the homepage form: name/email are known, so start at
  // "pick a sample business" and collect the password on the last step.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const n = q.get("name") ?? ""; const e = q.get("email") ?? "";
    const sc = q.get("scan"); if (sc) setScanDomain(sc.slice(0, 200));
    if (n && e) { setName(n); setEmail(e); setPrefilled(true); setStep(2); }
    trackMarketingEvent("trial_signup_start", { from: n && e ? "demo_form_prefill" : "start_page" });
  }, []);
  const [profile, setProfile] = useState<string>(STOCK_PROFILES[0].key);
  const [caps, setCaps] = useState<string[]>(["ai_presence", "outbound_gtm", "reviews_reputation"]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);

  const toggle = (k: string) => setCaps((c) => (c.includes(k) ? c.filter((x) => x !== k) : c.length < trial.capabilityLimit ? [...c, k] : c));
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/trial/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, email, password, stockProfile: profile, capabilities: caps, scanDomain }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not start the trial.");
      trackMarketingEvent("trial_signup_complete", { stockProfile: profile, capabilities: caps });
      const { error } = await createSupabaseBrowserClient().auth.signInWithPassword({ email, password });
      if (error) throw new Error("Account created, but sign-in failed. Use the sign-in page.");
      window.location.href = "/dashboard/agent?welcome=trial";
    } catch (e) { setError(e instanceof Error ? e.message : "Could not start the trial."); setBusy(false); }
  };

  return (
    <div className="rounded-[18px] p-7 md:p-9" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#30D158] mb-3">Free trial · step {step} of 3</div>
      {step === 1 && (
        <form onSubmit={(e) => { e.preventDefault(); setStep(2); }} className="flex flex-col gap-3">
          <h1 className="text-[28px] md:text-[34px] font-bold tracking-[-0.03em] leading-[1.05]">Get your agent. Watch it work on a sample business.</h1>
          <p className="text-[14px] text-white/[0.55] mb-2">{trial.credits} credits ≈ {bookedCallsFor(trial.credits)} booked calls of agent work. No card. No integrations. {trial.trialDays} days.</p>
          {scanDomain && <p className="text-[12.5px] text-[#30D158] -mt-1 mb-1">Your first tasks will mirror the live findings from your {scanDomain} preview.</p>}
          <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="h-[44px] rounded-[9px] px-3 text-[14px] outline-none" style={field} />
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="h-[44px] rounded-[9px] px-3 text-[14px] outline-none" style={field} />
          <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (8+ characters)" className="h-[44px] rounded-[9px] px-3 text-[14px] outline-none" style={field} />
          <button type="submit" className="mt-2 h-[46px] rounded-full bg-white text-black text-[14px] font-semibold">Continue →</button>
        </form>
      )}
      {step === 2 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-[26px] font-bold tracking-[-0.03em]">Pick a sample business.</h2>
          <p className="text-[14px] text-white/[0.55]">Stock data: fake prospects, calendar and reviews. One click, zero setup.</p>
          <div className="grid sm:grid-cols-2 gap-2.5 mt-1">
            {STOCK_PROFILES.map((p) => (
              <button key={p.key} type="button" onClick={() => setProfile(p.key)} className="text-left rounded-[12px] p-4 transition-colors" style={{ background: profile === p.key ? "#151515" : "#0F0F0F", border: `1px solid ${profile === p.key ? "#30D158" : "rgba(255,255,255,0.1)"}` }}>
                <div className="text-[14px] font-semibold">{p.name}</div>
                <div className="text-[12px] text-white/[0.5]">{p.category} · {p.city}, {p.state} · {p.reviews}★</div>
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-2"><button type="button" onClick={() => setStep(1)} className="h-[44px] px-5 rounded-full text-[14px]" style={{ border: "1px solid rgba(255,255,255,0.16)" }}>Back</button><button type="button" onClick={() => setStep(3)} className="flex-1 h-[44px] rounded-full bg-white text-black text-[14px] font-semibold">Continue →</button></div>
        </div>
      )}
      {step === 3 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-[26px] font-bold tracking-[-0.03em]">Pick {trial.capabilityLimit} capabilities to watch.</h2>
          <p className="text-[14px] text-white/[0.55]">Paid plans run all eight. Toggles are free, so you can change these later.</p>
          <div className="grid sm:grid-cols-2 gap-2 mt-1">
            {CAPABILITIES.map((c) => { const on = caps.includes(c.key); const full = !on && caps.length >= trial.capabilityLimit; return (
              <button key={c.key} type="button" disabled={full} onClick={() => toggle(c.key)} className="text-left rounded-[12px] p-3.5 transition-colors disabled:opacity-40" style={{ background: on ? "#151515" : "#0F0F0F", border: `1px solid ${on ? "#30D158" : "rgba(255,255,255,0.1)"}` }}>
                <div className="flex items-center justify-between"><span className="text-[13.5px] font-semibold">{c.name}</span><span className="text-[10.5px] uppercase tracking-wide" style={{ color: on ? "#30D158" : "#6E6E73" }}>{on ? "watching" : "off"}</span></div>
                <div className="text-[12px] text-white/[0.5] mt-0.5">{c.short}</div>
              </button>); })}
          </div>
          {prefilled && (
            <div className="flex flex-col gap-2 mt-1">
              <div className="text-[12.5px] text-white/[0.55]">Signing up as <span className="text-white">{name}</span> · {email}</div>
              <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Choose a password (8+ characters)" className="h-[44px] rounded-[9px] px-3 text-[14px] outline-none" style={field} />
            </div>
          )}
          {error && <div className="text-[12.5px] text-[#FF9F9A]">{error}</div>}
          <div className="flex gap-2 mt-2"><button type="button" onClick={() => setStep(2)} className="h-[44px] px-5 rounded-full text-[14px]" style={{ border: "1px solid rgba(255,255,255,0.16)" }}>Back</button><button type="button" disabled={busy || caps.length !== trial.capabilityLimit || (prefilled && password.length < 8)} onClick={submit} className="flex-1 h-[44px] rounded-full bg-white text-black text-[14px] font-semibold disabled:opacity-50">{busy ? "Creating your agent…" : "Start the agent →"}</button></div>
          <div className="text-[11px] text-white/[0.4]">Sandboxed: nothing is sent to real customers. Spend is shown per action; the price list unlocks on a paid plan.</div>
        </div>
      )}
    </div>
  );
}
