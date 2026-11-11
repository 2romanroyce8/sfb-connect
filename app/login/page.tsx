"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LOGO_MARK } from "@/lib/brand";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(next);
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#111] flex items-center justify-center px-6">
      <div className="w-full max-w-[420px]">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 text-[15px] font-semibold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_MARK} alt="" width={24} height={24} className="mix-blend-multiply" />
          SFB Connect
        </Link>
        <div className="rounded-[24px] border border-[#d8d8d3] bg-white p-6 sm:p-9">
          <h1 className="text-2xl font-bold mb-8">Sign in</h1>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="email"
              required
              aria-label="Email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-[#f7f7f5] border border-[#888] rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#111]"
            />
            <input
              type="password"
              required
              aria-label="Password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-[#f7f7f5] border border-[#888] rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#111]"
            />
            {error && <p className="text-sm text-red-700">{error}</p>}
            <div className="-mt-1 text-right"><Link href="/forgot-password" className="text-[12.5px] text-[#595959] hover:text-black underline underline-offset-2">Forgot password?</Link></div>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#111] text-white py-3 rounded-full font-semibold mt-2 hover:scale-[1.02] transition-transform disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
          <p className="text-sm text-[#595959] mt-6 text-center">
            New to SFB Connect?{" "}
            <Link href="/start" className="text-[#111] underline">
              Try the agent free
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
