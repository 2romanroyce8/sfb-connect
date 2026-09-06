"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UserRound, LockKeyhole, ArrowRight, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Third pass on this screen: no card, no labels, no placeholder copy — just
// two wide dark fields floating in a vignetted black frame with a tiny
// arrow-icon submit button. The autofill override is load-bearing: without
// it Chrome repaints the fields white the instant a saved credential fills
// them, which is the single most reference-breaking thing that can happen
// here.

function TeamLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/team/dashboard";
  const notAuthorized = params.get("error") === "not_authorized";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setLoading(false);
      setError("Invalid username or password.");
      return;
    }

    // Confirm this account is actually provisioned as a team member before
    // sending them into the CRM — team accounts are created by the owner,
    // there is no public signup here.
    const { data: profile } = await supabase
      .from("users")
      .select("team_role, team_status")
      .eq("id", data.user.id)
      .single();

    if (!profile?.team_role) {
      setLoading(false);
      await supabase.auth.signOut();
      setError("This account isn't set up for team access.");
      return;
    }

    if (profile.team_status === "disabled") {
      setLoading(false);
      await supabase.auth.signOut();
      setError("This account has been disabled. Contact your administrator.");
      return;
    }

    const now = new Date().toISOString();
    if (profile.team_status === "invited") {
      await supabase
        .from("users")
        .update({ team_status: "active", activated_at: now, last_active_at: now })
        .eq("id", data.user.id);
    } else {
      await supabase.from("users").update({ last_active_at: now }).eq("id", data.user.id);
    }

    setLoading(false);
    router.push(next);
  }

  return (
    <main
      className="w-full min-h-screen relative flex items-center justify-center overflow-hidden"
      style={{ background: "#050505", fontFamily: "Inter, SF Pro Display, Helvetica Neue, Arial, sans-serif" }}
    >
      {/* center glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 47%, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.028) 22%, rgba(255,255,255,0.012) 40%, rgba(0,0,0,0) 64%), radial-gradient(circle at 50% 50%, rgba(25,25,25,0.42) 0%, rgba(12,12,12,0.34) 38%, rgba(0,0,0,0.80) 100%)",
        }}
      />
      {/* heavy vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.22) 52%, rgba(0,0,0,0.82) 100%)" }}
      />
      {/* fine grain */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.015,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div
        className="relative flex flex-col items-center animate-[sfbFadeIn_500ms_ease]"
        style={{ width: 400, maxWidth: "calc(100vw - 48px)", zIndex: 10, transform: "translateY(-8px)" }}
      >
        {/* brand */}
        <div className="flex flex-col items-center" style={{ marginBottom: 70 }}>
          <span
            style={{
              fontFamily: "Inter, Helvetica Neue, Arial, sans-serif",
              fontSize: 18,
              fontWeight: 400,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#F2F2F2",
            }}
          >
            SFB Connect
          </span>
          <div className="flex items-center gap-[6px]" style={{ marginTop: 5, opacity: 0.38 }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <span key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: "#F2F2F2" }} />
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
          {notAuthorized && (
            <p style={{ fontSize: 10, color: "#B96A6A", marginBottom: 14, textAlign: "center" }}>
              That account doesn&apos;t have team access.
            </p>
          )}

          <div className="w-full flex flex-col" style={{ gap: 14 }}>
            <div
              className="relative flex items-center w-full"
              style={{
                height: 35,
                background: "#242424",
                border: "1px solid rgba(255,255,255,0.015)",
                borderRadius: 7,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.018), 0 4px 18px rgba(0,0,0,0.10)",
              }}
            >
              <UserRound size={16} strokeWidth={2.4} className="absolute left-[18px]" style={{ color: "#050505", opacity: 0.95 }} />
              <input
                type="email"
                required
                autoFocus
                autoComplete="username"
                aria-label="Username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="sfb-login-input w-full h-full outline-none"
                style={{ padding: "0 18px 0 48px", background: "transparent", color: "#D8D8D8", fontSize: 13, fontWeight: 400, borderRadius: 7 }}
              />
            </div>

            <div
              className="relative flex items-center w-full"
              style={{
                height: 35,
                background: "#242424",
                border: "1px solid rgba(255,255,255,0.015)",
                borderRadius: 7,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.018), 0 4px 18px rgba(0,0,0,0.10)",
              }}
            >
              <LockKeyhole size={16} strokeWidth={2.4} className="absolute left-[18px]" style={{ color: "#050505", opacity: 0.95 }} />
              <input
                type="password"
                required
                autoComplete="current-password"
                aria-label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="sfb-login-input w-full h-full outline-none"
                style={{ padding: "0 18px 0 48px", background: "transparent", color: "#D8D8D8", fontSize: 13, fontWeight: 400, borderRadius: 7 }}
              />
            </div>
          </div>

          {error && <p style={{ fontSize: 10, fontWeight: 400, color: "#B96A6A", marginTop: 9, textAlign: "center" }}>{error}</p>}

          <div className="w-full flex justify-center" style={{ marginTop: 65 }}>
            <button
              type="submit"
              disabled={loading}
              className="disabled:opacity-60"
              style={{
                width: 105,
                height: 35,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#080808",
                border: "1px solid rgba(255,255,255,0.025)",
                borderRadius: 2,
                boxShadow: "0 6px 18px rgba(0,0,0,0.28)",
                color: "#7B7B7B",
              }}
            >
              {loading ? <Loader2 size={18} strokeWidth={1.5} className="animate-spin" /> : <ArrowRight size={24} strokeWidth={1} />}
            </button>
          </div>

          <a
            href="/team/forgot-password"
            style={{ marginTop: 18, fontSize: 9, fontWeight: 400, color: "rgba(255,255,255,0.24)", textDecoration: "none" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.24)")}
          >
            Forgot password?
          </a>
        </form>
      </div>

      <style jsx global>{`
        @keyframes sfbFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .sfb-login-input {
          -webkit-appearance: none;
          appearance: none;
          box-sizing: border-box;
          border: none;
          caret-color: #ffffff;
        }
        .sfb-login-input:focus {
          background: #272727 !important;
          outline: none !important;
          box-shadow: none !important;
        }
        .sfb-login-input:-webkit-autofill,
        .sfb-login-input:-webkit-autofill:hover,
        .sfb-login-input:-webkit-autofill:focus,
        .sfb-login-input:-webkit-autofill:active {
          -webkit-text-fill-color: #d8d8d8 !important;
          -webkit-box-shadow: 0 0 0 1000px #242424 inset !important;
          box-shadow: 0 0 0 1000px #242424 inset !important;
          caret-color: #ffffff !important;
          transition: background-color 9999s ease-out 0s;
        }
      `}</style>
    </main>
  );
}

export default function TeamLoginPage() {
  return (
    <Suspense fallback={null}>
      <TeamLoginForm />
    </Suspense>
  );
}
