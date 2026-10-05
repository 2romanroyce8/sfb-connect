"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LockKeyhole, ArrowRight, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Public (logged-out) landing page for Supabase recovery links. Completes
// the recovery -- `?code=` (PKCE) is exchanged for a session; a legacy
// `#access_token=...&type=recovery` hash is picked up automatically by the
// client -- then lets the user choose a new password via updateUser, which
// is the same call Settings already uses for a signed-in change.
function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [phase, setPhase] = useState<"verifying" | "ready" | "invalid">("verifying");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    async function verify() {
      const code = params.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (!cancelled) setPhase("invalid");
          return;
        }
      }
      // Give the client a tick to ingest a hash-based token if that's what
      // the link carried, then confirm we actually hold a session.
      const { data } = await supabase.auth.getSession();
      if (!cancelled) setPhase(data.session ? "ready" : "invalid");
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setPhase("ready");
    });
    verify();
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [params]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) return setError(updateError.message || "Could not update password.");
    router.push("/team/dashboard");
  }

  const field = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div
      className="relative flex items-center w-full"
      style={{ height: 35, background: "#242424", border: "1px solid rgba(255,255,255,0.015)", borderRadius: 7, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.018), 0 4px 18px rgba(0,0,0,0.10)" }}
    >
      <LockKeyhole size={16} strokeWidth={2.4} className="absolute left-[18px]" style={{ color: "#050505", opacity: 0.95 }} />
      <input {...props} className="w-full h-full outline-none" style={{ padding: "0 18px 0 48px", background: "transparent", color: "#D8D8D8", fontSize: 13, borderRadius: 7 }} />
    </div>
  );

  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: "#000" }}>
      <div className="w-full" style={{ maxWidth: 300 }}>
        <div className="text-center" style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.14em", color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>SFB TEAM</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 10, lineHeight: 1.5 }}>
            {phase === "verifying" && "Verifying your reset link…"}
            {phase === "ready" && "Choose a new password."}
            {phase === "invalid" && "This reset link is invalid or has expired. Request a new one."}
          </div>
        </div>

        {phase === "verifying" && (
          <div className="flex justify-center">
            <Loader2 size={18} strokeWidth={1.5} className="animate-spin" style={{ color: "#7B7B7B" }} />
          </div>
        )}

        {phase === "ready" && (
          <form onSubmit={handleSubmit} className="flex flex-col items-center gap-3">
            {field({ type: "password", required: true, autoFocus: true, autoComplete: "new-password", "aria-label": "New password", value: password, onChange: (e) => setPassword(e.target.value) })}
            {field({ type: "password", required: true, autoComplete: "new-password", "aria-label": "Confirm new password", value: confirm, onChange: (e) => setConfirm(e.target.value) })}
            {error && <p style={{ fontSize: 10, color: "#B96A6A", marginTop: 6, textAlign: "center" }}>{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="disabled:opacity-60"
              style={{ marginTop: 28, width: 105, height: 35, display: "flex", alignItems: "center", justifyContent: "center", background: "#080808", border: "1px solid rgba(255,255,255,0.025)", borderRadius: 2, boxShadow: "0 6px 18px rgba(0,0,0,0.28)", color: "#7B7B7B" }}
            >
              {saving ? <Loader2 size={18} strokeWidth={1.5} className="animate-spin" /> : <ArrowRight size={24} strokeWidth={1} />}
            </button>
          </form>
        )}

        <div className="text-center" style={{ marginTop: 22 }}>
          <a href={phase === "invalid" ? "/team/forgot-password" : "/team/login"} style={{ fontSize: 9, color: "rgba(255,255,255,0.24)", textDecoration: "none" }}>
            {phase === "invalid" ? "Request a new link" : "Back to sign in"}
          </a>
        </div>
      </div>
    </main>
  );
}

export default function TeamResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
