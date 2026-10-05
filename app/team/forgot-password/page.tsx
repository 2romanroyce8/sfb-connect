"use client";

import { useState } from "react";
import { UserRound, ArrowRight, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Public (logged-out) page. Sends a Supabase recovery email whose link lands
// on /team/reset-password. Always responds with the same neutral message so
// the form can't be used to discover which emails have team accounts.
export default function TeamForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/team/reset-password`,
    });
    setLoading(false);
    // Rate-limit / config errors are worth surfacing; "user not found" is
    // deliberately not distinguishable from success.
    if (resetError && !/user/i.test(resetError.message)) {
      setError("Could not send the reset email right now. Try again in a minute.");
      return;
    }
    setSent(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: "#000" }}>
      <div className="w-full" style={{ maxWidth: 300 }}>
        <div className="text-center" style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.14em", color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>SFB TEAM</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 10, lineHeight: 1.5 }}>
            {sent ? "If that email has a team account, a reset link is on its way. Check spam if it doesn't arrive within a couple of minutes." : "Enter your account email and we'll send a link to set a new password."}
          </div>
        </div>

        {!sent && (
          <form onSubmit={handleSubmit} className="flex flex-col items-center">
            <div
              className="relative flex items-center w-full"
              style={{ height: 35, background: "#242424", border: "1px solid rgba(255,255,255,0.015)", borderRadius: 7, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.018), 0 4px 18px rgba(0,0,0,0.10)" }}
            >
              <UserRound size={16} strokeWidth={2.4} className="absolute left-[18px]" style={{ color: "#050505", opacity: 0.95 }} />
              <input
                type="email"
                required
                autoFocus
                autoComplete="username"
                aria-label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-full outline-none"
                style={{ padding: "0 18px 0 48px", background: "transparent", color: "#D8D8D8", fontSize: 13, borderRadius: 7 }}
              />
            </div>

            {error && <p style={{ fontSize: 10, color: "#B96A6A", marginTop: 9, textAlign: "center" }}>{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="disabled:opacity-60"
              style={{ marginTop: 40, width: 105, height: 35, display: "flex", alignItems: "center", justifyContent: "center", background: "#080808", border: "1px solid rgba(255,255,255,0.025)", borderRadius: 2, boxShadow: "0 6px 18px rgba(0,0,0,0.28)", color: "#7B7B7B" }}
            >
              {loading ? <Loader2 size={18} strokeWidth={1.5} className="animate-spin" /> : <ArrowRight size={24} strokeWidth={1} />}
            </button>
          </form>
        )}

        <div className="text-center" style={{ marginTop: 22 }}>
          <a href="/team/login" style={{ fontSize: 9, color: "rgba(255,255,255,0.24)", textDecoration: "none" }}>
            Back to sign in
          </a>
        </div>
      </div>
    </main>
  );
}
