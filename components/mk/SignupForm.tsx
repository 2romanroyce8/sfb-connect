"use client";
import Link from "next/link";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Creates a Supabase account (the same auth the whole app uses), then the agency is created at /app/start. Passwords go straight to Supabase Auth.
export default function SignupForm() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [sent, setSent] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    if (password.length < 8) { setErr("Use a password of at least 8 characters."); return; }
    setBusy(true);
    const { data, error } = await createSupabaseBrowserClient().auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/app/start` } });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    if (data.session) { window.location.href = "/app/start"; return; }
    setSent(true);
  }
  if (sent) return <div className="mk-card p-8 max-w-[440px] w-full"><h1 className="text-[26px]">Check your email</h1><p className="mt-3 text-[15px]" style={{ color: "var(--mk-muted)" }}>We sent a confirmation link to {email}. Open it to finish, then you will name your agency.</p></div>;
  return (
    <form onSubmit={go} className="mk-card p-8 max-w-[440px] w-full flex flex-col gap-4">
      <h1 className="text-[28px]">Start your agency</h1>
      <p className="text-[14.5px]" style={{ color: "var(--mk-muted)" }}>Create your account. Next you will name your agency.</p>
      <label className="flex flex-col gap-1.5 text-[13px]" style={{ color: "var(--mk-muted)" }}>Email<input type="email" required autoComplete="email" className="mk-input" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="flex flex-col gap-1.5 text-[13px]" style={{ color: "var(--mk-muted)" }}>Password<input type="password" required autoComplete="new-password" minLength={8} className="mk-input" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {err && <div role="alert" className="text-[13.5px]" style={{ color: "var(--mk-blue2)" }}>{err}</div>}
      <button disabled={busy} className="mk-btn mk-btn-primary w-full disabled:opacity-50">{busy ? "Creating…" : "Create account"}</button>
      <p className="text-[13px] text-center" style={{ color: "var(--mk-muted)" }}>Already have an account? <Link href="/login?next=/app" className="underline">Log in</Link></p>
    </form>
  );
}
