"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Deliberately tiny, deliberately restrained — the whole point of this
// screen is that the login form is a small terminal-style widget sitting in
// the center of a huge, almost-empty dark panel. Resist the urge to make
// this a normal 400px SaaS login card.

function Rings() {
  const rings = [
    { size: 500, border: 42, opacity: 0.18 },
    { size: 410, border: 40, opacity: 0.16 },
    { size: 320, border: 38, opacity: 0.14 },
    { size: 230, border: 34, opacity: 0.12 },
  ];
  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: "24%", top: "5%", width: 520, height: 520, transform: "translateX(-50%)" }}
    >
      {rings.map((r, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: r.size,
            height: r.size,
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            border: `${r.border}px solid rgba(47,26,27,0.13)`,
            opacity: r.opacity,
          }}
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
      style={{ background: "#1B1818" }}
    >
      {/* outer atmosphere */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.012) 24%, transparent 58%), linear-gradient(to bottom, rgba(0,0,0,0.02), rgba(0,0,0,0.14))",
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
        className="relative flex items-center justify-center"
        style={{
          width: "76.7vw",
          maxWidth: 920,
          height: "74.5vh",
          maxHeight: 598,
          minHeight: 520,
          background: "#090909",
          border: "1px solid rgba(255,255,255,0.015)",
          borderRadius: 8,
          boxShadow: "0 24px 70px rgba(0,0,0,0.28), 0 4px 14px rgba(0,0,0,0.20)",
          overflow: "hidden",
        }}
      >
        <Rings />

        {/* login stack */}
        <div className="relative flex flex-col items-center" style={{ width: 218, zIndex: 5, transform: "translateY(-2px)" }}>
          {/* brand */}
          <div className="flex items-center justify-center mb-3" style={{ height: 24, gap: 5 }}>
            <svg width="18" height="18" viewBox="0 0 18 18" style={{ color: "#D8D8D8", opacity: 0.9 }}>
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
                fontSize: 8,
                fontWeight: 500,
                letterSpacing: "0.32em",
                color: "#DADADA",
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
              background: "rgba(10,10,10,0.76)",
              border: "1px solid rgba(255,255,255,0.075)",
              borderRadius: 2,
              boxShadow: "0 8px 28px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.012)",
              overflow: "hidden",
            }}
          >
            <div
              className="flex items-center"
              style={{
                height: 27,
                padding: "0 8px",
                background: "rgba(15,15,15,0.75)",
                borderBottom: "1px solid rgba(255,255,255,0.055)",
              }}
            >
              <span style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 7, fontWeight: 400, color: "#D0D0D0" }}>
                User Login
              </span>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex flex-col"
              style={{ padding: "17px 8px 16px 8px", gap: 10 }}
            >
              {notAuthorized && (
                <div style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 6, color: "#FF6B6B" }}>
                  That account doesn&apos;t have team access.
                </div>
              )}

              <div>
                <div style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 6.5, color: "#B5B5B5", marginBottom: 4 }}>
                  Username
                </div>
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="Username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full outline-none"
                  style={{
                    height: 22,
                    padding: "0 7px",
                    fontFamily: "Arial, Helvetica, sans-serif",
                    fontSize: 6.5,
                    color: "#D0D0D0",
                    background: "#0C0C0C",
                    border: "1px solid rgba(255,255,255,0.075)",
                    borderRadius: 1,
                    boxShadow: "inset 0 1px 4px rgba(0,0,0,0.55)",
                  }}
                />
              </div>

              <div>
                <div style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 6.5, color: "#B5B5B5", marginBottom: 4 }}>
                  Password
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full outline-none"
                    style={{
                      height: 22,
                      padding: "0 20px 0 7px",
                      fontFamily: "Arial, Helvetica, sans-serif",
                      fontSize: 6.5,
                      color: "#D0D0D0",
                      background: "#0C0C0C",
                      border: "1px solid rgba(255,255,255,0.075)",
                      borderRadius: 1,
                      boxShadow: "inset 0 1px 4px rgba(0,0,0,0.55)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-[5px] top-1/2 -translate-y-1/2"
                    style={{ color: "#8C8C8C" }}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={10} /> : <Eye size={10} />}
                  </button>
                </div>
              </div>

              {error && (
                <p style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: 6, color: "#FF6B6B" }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="self-center disabled:opacity-60"
                style={{
                  width: 91,
                  height: 20,
                  marginTop: 3,
                  background: "linear-gradient(to bottom, #2B2B2B, #1B1B1B)",
                  border: "1px solid rgba(255,255,255,0.50)",
                  borderRadius: 2,
                  color: "#E8E8E8",
                  fontFamily: "Arial, Helvetica, sans-serif",
                  fontSize: 6.5,
                  fontWeight: 400,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 2px rgba(0,0,0,0.45)",
                }}
              >
                {loading ? "Logging in..." : "Login"}
              </button>

              <a
                href="/team/forgot-password"
                className="self-center hover:text-white"
                style={{
                  marginTop: 5,
                  fontFamily: "Arial, Helvetica, sans-serif",
                  fontSize: 6,
                  color: "#BCBCBC",
                  textDecoration: "none",
                }}
              >
                Forgotten Password?
              </a>
            </form>
          </div>
        </div>
      </div>
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
