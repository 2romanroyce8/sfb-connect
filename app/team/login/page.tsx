"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function TeamLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/team/dashboard";
  const notAuthorized = params.get("error") === "not_authorized";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
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
      setError("Invalid email or password.");
      return;
    }

    // Confirm this account is actually provisioned as a team member before
    // sending them into the CRM — team accounts are created by the owner,
    // there is no public signup here.
    const { data: profile } = await supabase
      .from("users")
      .select("team_role")
      .eq("id", data.user.id)
      .single();

    setLoading(false);

    if (!profile?.team_role) {
      await supabase.auth.signOut();
      setError("This account isn't set up for team access.");
      return;
    }

    router.push(next);
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-[380px]">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight">
            <span className="w-6 h-6 rounded-full border border-white/25 inline-block" />
            SFB CONNECT
          </div>
          <div className="mt-2 text-[12px] text-white/40 tracking-wide uppercase">
            Team Workspace
          </div>
        </div>

        <div
          className="rounded-[16px] p-8"
          style={{
            background: "#0A0A0A",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {notAuthorized && (
            <div className="mb-5 text-[13px] text-[#FF453A] bg-[#FF453A]/10 border border-[#FF453A]/20 rounded-[10px] px-3 py-2.5">
              That account doesn&apos;t have team access.
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <input
              type="email"
              required
              autoFocus
              placeholder="Email or username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-[44px] rounded-[10px] px-3.5 text-[14px] outline-none transition-colors"
              style={{
                background: "#101010",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#F5F5F7",
              }}
            />
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-[44px] w-full rounded-[10px] px-3.5 pr-10 text-[14px] outline-none transition-colors"
                style={{
                  background: "#101010",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#F5F5F7",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6E6E73] hover:text-[#A1A1A6]"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            <div className="flex items-center justify-between mt-1">
              <label className="flex items-center gap-2 text-[12.5px] text-[#A1A1A6] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-3.5 h-3.5 rounded"
                />
                Remember this device
              </label>
              <a href="/team/forgot-password" className="text-[12.5px] text-[#A1A1A6] hover:text-white">
                Forgot password?
              </a>
            </div>

            {error && <p className="text-[13px] text-[#FF453A]">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="h-[44px] rounded-[10px] bg-white text-black text-[14px] font-semibold mt-2 hover:scale-[1.01] transition-transform disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-[11.5px] text-[#6E6E73] mt-6">
          Team accounts are created by an SFB Connect administrator.
        </p>
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
