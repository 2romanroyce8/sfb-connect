"use client";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Join a client portal from an invite link: sign in or create an account (use the SAME email the invite was sent to), then the server accepts the invite.
export default function JoinForm({ token }: { token: string }) {
  const [mode, setMode] = useState<"signup" | "signin">("signup"); const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [sent, setSent] = useState(false); const [signedIn, setSignedIn] = useState<string | null>(null);
  const supa = () => createSupabaseBrowserClient();
  async function accept() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/portal/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) }); const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(j.error || "That didn't work."); setBusy(false); return; } window.location.href = "/portal";
  }
  useEffect(() => { void supa().auth.getUser().then(({ data }) => { if (data.user?.email) setSignedIn(data.user.email); }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    if (mode === "signin") { const { error } = await supa().auth.signInWithPassword({ email: email.trim(), password: pw }); if (error) { setErr(error.message); setBusy(false); return; } await accept(); return; }
    if (pw.length < 8) { setErr("Use a password of at least 8 characters."); setBusy(false); return; }
    const { data, error } = await supa().auth.signUp({ email: email.trim(), password: pw, options: { emailRedirectTo: `${window.location.origin}/portal/join?token=${encodeURIComponent(token)}` } });
    if (error) { setErr(error.message); setBusy(false); return; }
    if (data.session) { await accept(); return; } setSent(true); setBusy(false);
  }
  if (!token) return <div className="mk-card p-8 max-w-[440px] w-full"><h1 className="text-[26px]">Invite link needed</h1><p className="mt-3 text-[15px]" style={{ color: "var(--mk-muted)" }}>Open the full invite link your agency sent you.</p></div>;
  if (sent) return <div className="mk-card p-8 max-w-[440px] w-full"><h1 className="text-[26px]">Check your email</h1><p className="mt-3 text-[15px]" style={{ color: "var(--mk-muted)" }}>We sent a confirmation link to {email}. Open it and you&apos;ll land back here to finish joining.</p></div>;
  if (signedIn) return <div className="mk-card p-8 max-w-[440px] w-full flex flex-col gap-4"><h1 className="text-[26px]">Join your portal</h1><p className="text-[15px]" style={{ color: "var(--mk-muted)" }}>You&apos;re signed in as {signedIn}. The invite must have been sent to this address.</p>{err && <div role="alert" className="text-[13.5px]" style={{ color: "var(--mk-blue2)" }}>{err}</div>}<button disabled={busy} onClick={() => void accept()} className="mk-btn mk-btn-primary">{busy ? "Joining…" : "Join portal"}</button><button type="button" onClick={async () => { await supa().auth.signOut(); setSignedIn(null); }} className="text-[13px] underline" style={{ color: "var(--mk-muted)" }}>Use a different account</button></div>;
  return (
    <form onSubmit={go} className="mk-card p-8 max-w-[440px] w-full flex flex-col gap-4">
      <h1 className="text-[26px]">{mode === "signup" ? "Create your login" : "Sign in"}</h1><p className="text-[14.5px]" style={{ color: "var(--mk-muted)" }}>Use the email address your agency invited.</p>
      <label className="flex flex-col gap-1.5 text-[13px]" style={{ color: "var(--mk-muted)" }}>Email<input type="email" required autoComplete="email" className="mk-input" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="flex flex-col gap-1.5 text-[13px]" style={{ color: "var(--mk-muted)" }}>Password<input type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} className="mk-input" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
      {err && <div role="alert" className="text-[13.5px]" style={{ color: "var(--mk-blue2)" }}>{err}</div>}
      <button disabled={busy} className="mk-btn mk-btn-primary disabled:opacity-50">{busy ? "Working…" : mode === "signup" ? "Create login and join" : "Sign in and join"}</button>
      <button type="button" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setErr(null); }} className="text-[13px] underline" style={{ color: "var(--mk-muted)" }}>{mode === "signup" ? "I already have a login" : "I need to create a login"}</button>
    </form>
  );
}
