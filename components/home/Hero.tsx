"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Hero() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("sfb_lead_email", email);
      }
      router.push("/pay");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <section className="relative h-screen w-full overflow-hidden">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-70"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260325_120549_0cd82c36-56b3-4dd9-b190-069cfc3a623f.mp4"
      />
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-background to-transparent" />

      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6 pt-28 md:pt-32">
        <h1 className="text-[40px] sm:text-[56px] md:text-[76px] lg:text-[92px] font-extrabold leading-[1.02] tracking-[-0.03em] max-w-4xl">
          Your customers are asking AI{" "}
          <span className="font-serif-accent italic font-normal">
            who to choose.
          </span>
        </h1>

        <div className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-[-0.02em] mt-4 text-medium-gray">
          Make sure it can find you.
        </div>

        <p
          className="max-w-xl text-lg mt-7 leading-relaxed"
          style={{ color: "hsl(var(--hero-subtitle))" }}
        >
          We analyze and optimize how your business is represented across the
          digital signals AI systems can use when answering local and
          commercial recommendations.
        </p>

        <form
          onSubmit={handleSubmit}
          className="liquid-glass rounded-full p-2 max-w-lg w-full mx-auto mt-9 flex items-center gap-2"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your business email"
            className="flex-1 bg-transparent border-none outline-none px-5 text-sm placeholder:text-medium-gray"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-white text-black rounded-full px-7 py-3 text-sm font-semibold whitespace-nowrap hover:scale-[1.03] active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {loading ? "…" : "ANALYZE MY BUSINESS"}
          </button>
        </form>
        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}

        <div className="mt-8 flex items-baseline gap-4 flex-wrap justify-center">
          <div className="font-mono text-lg font-semibold tracking-wide">
            $200 / YEAR
          </div>
          <div className="text-[13px] text-medium-gray">
            One annual payment. No monthly subscription.
          </div>
        </div>
      </div>
    </section>
  );
}
