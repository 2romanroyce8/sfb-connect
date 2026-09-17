"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Customer login -- distinct from /team/login (internal Sales OS reps).
// There is no public signup here either: a customer account is provisioned
// automatically the moment their deal is marked Won in the Sales OS
// (see app/api/team/leads/[id]/stage/route.ts), which sends them a real
// Supabase invite email to set their password. This page is only where
// they come back to sign in afterward.
function CustomerLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard/billing";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !data.user) {
      setLoading(false);
      setError("Invalid email or password.");
      return;
    }

    // Confirm this is a real provisioned customer account (owns a
    // business) before sending them into the customer dashboard -- a
    // Sales OS rep account signing in here gets turned back, same as the
    // reverse is true on /team/login.
    const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", data.user.id).maybeSingle();
    if (!business) {
      setLoading(false);
      await supabase.auth.signOut();
      setError("This account isn't set up as an SFB Connect customer.");
      return;
    }

    setLoading(false);
    router.push(next);
  }

  return (
    <main className="w-full min-h-screen flex items-center justify-center px-6" style={{ background: "#050505" }}>
      <div className="w-full max-w-[380px]">
        <div className="text-center mb-8">
          <div className="text-[13px] font-semibold tracking-[0.14em] uppercase text-white/50">SFB Connect</div>
          <div className="text-[22px] font-semibold text-white mt-2">Sign in to your account</div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="h-[46px] rounded-[10px] px-4 text-[14px] outline-none"
            style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F5F7" }}
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="h-[46px] rounded-[10px] px-4 text-[14px] outline-none"
            style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F5F7" }}
          />
          {error && <p className="text-[13px] text-[#FF6B6B]">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="h-[46px] rounded-[10px] bg-white text-black text-[14px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60 mt-1"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <>Sign In <ArrowRight size={14} /></>}
          </button>
        </form>
        <p className="text-center text-[12.5px] text-white/40 mt-6">
          New customer accounts are created automatically after signing up with SFB Connect. Check your email for an invite.
        </p>
      </div>
    </main>
  );
}

export default function CustomerLoginPage() {
  return (
    <Suspense>
      <CustomerLoginForm />
    </Suspense>
  );
}
