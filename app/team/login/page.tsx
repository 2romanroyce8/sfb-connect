"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Deliberately tiny, deliberately restrained — the whole point of this
// screen is that the login form is a small terminal-style widget sitting in
// the center of a huge, almost-empty dark panel. Resist the urge to make
// this a normal 400px SaaS login card. The autofill override below exists
// because Chrome silently repaints inputs white on autofill regardless of
// any background color set in JS-driven inline styles — only an actual
// :-webkit-autofill CSS rule can override that.

function Rings() {
  const rings = [
    { size: 500, border: "42px solid rgba(57,30,31,0.08)" },
    { size: 405, border: "38px solid rgba(57,30,31,0.075)" },
    { size: 315, border: "36px solid rgba(57,30,31,0.07)" },
    { size: 225, border: "32px solid rgba(57,30,31,0.065)" },
  ];
  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: "39%", top: "48%", width: 500, height: 500, transform: "translate(-50%, -50%)", opacity: 0.55 }}
    >
      {rings.map((r, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{ width: r.size, height: r.size, left: "50%", top: "50%", transform: "translate(-50%, -50%)", border: r.border }}
        />
      ))}
    </div>
  );
}

function TeamLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/team/dashboard";
  const notAuthorized = params.get("error") === "not_authorized";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      className="min-h-screen w-full flex items-center justify-center overflow-hidden relative"
      style={{ background: "#1A1717" }}
    >
      {/* outer atmosphere — must not read as flat black */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 48%, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.008) 34%, transparent 62%), radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,0.20) 100%)",
        }}
      />
      {/* faint grain */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.015,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* main panel */}
      <div
        className="relative"
        style={{
          width: "76.5vw",
          maxWidth: 920,
          height: "74.5vh",
          maxHeight: 598,
          minHeight: 520,
          background: "#080808",
          border: "1px solid rgba(255,255,255,0.018)",
          borderRadius: 8,
          boxShadow: "0 28px 75px rgba(0,0,0,0.30)",
          overflow: "hidden",
        }}
      >
        <Rings />

        {/* login stack — absolutely positioned, not flex-centered, so it can
            sit slightly above dead-center to match the reference exactly */}
        <div
          className="absolute flex flex-col items-center"
          style={{ left: "50%", top: "50%", transform: "translate(-50%, -47%)", width: 218, zIndex: 10 }}
        >
          {/* brand — quiet, small, not a hero logo */}
          <div className="flex items-center justify-center" style={{ height: 20, marginBottom: 11, gap: 5 }}>
            <svg width="15" height="15" viewBox="0 0 18 18" style={{ color: "rgba(235,235,235,0.78)", opacity: 0.78 }}>
              <path
                d="M13 4.5c-1-1-2.4-1.5-4-1.5-2.8 0-5 1.8-5 4 0 5 8 3.3 8 7.2 0 2.2-2.2 4-5 4-1.6 0-3-.5-4-1.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            <span
              style={{
                fontFamily: "Inter, Helvetica Neue, Arial, sans-serif",
                fontSize: 7,
                fontWeight: 500,
                letterSpacing: "0.28em",
                color: "rgba(235,235,235,0.78)",
                textTransform: "uppercase",
              }}
            >
              SFB Connect
            </span>
          </div>

          {/* card */}
          <div
            style={{
              width: 218,
              background: "rgba(8,8,8,0.82)",
              border: "1px solid rgba(255,255,255,0.065)",
              borderRadius: 1,
              boxShadow: "0 8px 25px rgba(0,0,0,0.18)",
              overflow: "hidden",
            }}
          >
            <div
              className="flex items-center"
              style={{ height: 27, padding: "0 8px", background: "#0B0B0B", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              <span style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 7, fontWeight: 400, color: "rgba(220,220,220,0.82)" }}>
                User Login
              </span>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col" style={{ padding: "16px 8px 15px", gap: 10 }}>
              {notAuthorized && (
                <div style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 6, color: "#FF6B6B" }}>
                  That account doesn&apos;t have team access.
                </div>
              )}

              <div>
                <div style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 6, color: "rgba(190,190,190,0.72)", marginBottom: 4 }}>
                  Username
                </div>
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="Username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="sfb-login-input w-full outline-none"
                  style={{
                    height: 21,
                    padding: "0 7px",
                    fontFamily: "Arial, Helvetica, sans-serif",
                    fontSize: 6.5,
                    color: "#C8C8C8",
                    background: "#0B0B0B",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 1,
                    boxShadow: "inset 0 1px 4px rgba(0,0,0,0.55)",
                  }}
                />
              </div>

              <div>
                <div style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 6, color: "rgba(190,190,190,0.72)", marginBottom: 4 }}>
                  Password
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="sfb-login-input w-full outline-none"
                    style={{
                      height: 21,
                      padding: "0 20px 0 7px",
                      fontFamily: "Arial, Helvetica, sans-serif",
                      fontSize: 6.5,
                      color: "#C8C8C8",
                      background: "#0B0B0B",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 1,
                      boxShadow: "inset 0 1px 4px rgba(0,0,0,0.55)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-[6px] top-1/2 -translate-y-1/2"
                    style={{ color: "rgba(180,180,180,0.55)" }}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={9} /> : <Eye size={9} />}
                  </button>
                </div>
              </div>

              {error && <p style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 6, color: "#FF6B6B" }}>{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="self-center disabled:opacity-60"
                style={{
                  width: 90,
                  height: 19,
                  marginTop: 3,
                  background: "linear-gradient(180deg, #292929 0%, #191919 100%)",
                  border: "1px solid rgba(255,255,255,0.42)",
                  borderRadius: 2,
                  color: "rgba(240,240,240,0.88)",
                  fontFamily: "Arial, Helvetica, sans-serif",
                  fontSize: 6,
                  fontWeight: 400,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                }}
              >
                {loading ? "Logging in..." : "Login"}
              </button>

              <a
                href="/team/forgot-password"
                className="self-center hover:text-white"
                style={{
                  marginTop: 6,
                  fontFamily: "Arial, Helvetica, sans-serif",
                  fontSize: 5.8,
                  color: "rgba(205,205,205,0.72)",
                  textDecoration: "none",
                  textAlign: "center",
                }}
              >
                Forgotten Password?
              </a>
            </form>
          </div>
        </div>
      </div>

      {/* Browser/Chrome resets that inline styles alone cannot override:
          autofill background, default appearance, and the blue focus ring. */}
      <style jsx global>{`
        .sfb-login-input {
          -webkit-appearance: none;
          appearance: none;
          box-sizing: border-box;
          caret-color: #c8c8c8;
        }
        .sfb-login-input::placeholder {
          color: #353535;
        }
        .sfb-login-input:focus {
          background: #0c0c0c !important;
          border: 1px solid rgba(255, 255, 255, 0.17) !important;
          box-shadow: none !important;
          outline: none !important;
        }
        .sfb-login-input:-webkit-autofill,
        .sfb-login-input:-webkit-autofill:hover,
        .sfb-login-input:-webkit-autofill:focus,
        .sfb-login-input:-webkit-autofill:active {
          -webkit-text-fill-color: #c8c8c8 !important;
          -webkit-box-shadow: 0 0 0 1000px #0b0b0b inset !important;
          box-shadow: 0 0 0 1000px #0b0b0b inset !important;
          caret-color: #c8c8c8 !important;
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
