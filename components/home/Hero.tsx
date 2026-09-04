"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import AmbientOrb from "@/components/ui/AmbientOrb";
import { Accent } from "@/components/ui/EditorialHeading";

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
    <section className="relative min-h-screen w-full overflow-hidden flex items-center pt-32 pb-20 px-6 md:px-14">
      <div className="max-w-[1280px] mx-auto w-full grid lg:grid-cols-[1.1fr_0.9fr] gap-16 items-center relative z-10">
        {/* Left: editorial copy */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: "easeOut" }}
        >
          <div className="flex items-center gap-2.5 font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
            THE SHIFT
          </div>

          <h1 className="text-[40px] sm:text-[54px] md:text-[68px] lg:text-[76px] font-extrabold leading-[1.0] tracking-[-0.03em]">
            Search gave people choices. AI gives people{" "}
            <Accent>answers.</Accent>
          </h1>

          <p
            className="max-w-lg text-lg mt-7 leading-relaxed"
            style={{ color: "hsl(var(--hero-subtitle))" }}
          >
            Customers are increasingly asking AI who to choose, where to go,
            what to buy and which business best fits their needs.
          </p>

          <form
            onSubmit={handleSubmit}
            className="liquid-glass rounded-full p-2 max-w-md w-full mt-9 flex items-center gap-2"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your business email"
              className="flex-1 bg-transparent border-none outline-none px-5 text-sm placeholder:text-medium-gray min-w-0"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-white text-black rounded-full px-6 py-3 text-sm font-semibold whitespace-nowrap hover:scale-[1.03] active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {loading ? "…" : "Check My AI Presence"}
            </button>
          </form>
          {error && <p className="text-sm text-red-400 mt-3">{error}</p>}

          <div className="mt-8 flex items-baseline gap-4 flex-wrap">
            <div className="font-mono text-lg font-semibold tracking-wide">
              $200 / YEAR
            </div>
            <div className="text-[13px] text-medium-gray">
              One annual payment. No monthly subscription.
            </div>
          </div>
        </motion.div>

        {/* Right: glass capsule AI answer demo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          className="relative h-[440px] md:h-[520px] flex items-center justify-center"
        >
          <AmbientOrb color="violet" size={260} className="right-[5%] top-[5%]" />
          <AmbientOrb color="green" size={200} className="left-[5%] top-[10%]" duration={9} />
          <AmbientOrb color="cyan" size={220} className="left-[15%] bottom-[8%]" duration={13} />

          <div className="glass-edge relative z-10 w-full max-w-[380px] rounded-[36px] p-7">
            <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-medium-gray mb-5">
              Ask AI
            </div>
            <div className="text-[15px] font-medium mb-6 leading-snug">
              &quot;Who is the best plumber near me?&quot;
            </div>
            <div className="flex flex-col gap-2.5">
              {["Acme Plumbing", "Rapid Rooter Co.", "Metro Pipe Works"].map(
                (name, i) => (
                  <div
                    key={name}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm ${
                      i === 0
                        ? "bg-white/10 border border-white/25 font-semibold"
                        : "bg-white/[0.03] border border-transparent text-medium-gray"
                    }`}
                  >
                    <span className="font-mono text-xs text-medium-gray w-4">
                      0{i + 1}
                    </span>
                    {name}
                  </div>
                )
              )}
            </div>
            <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap gap-2">
              {["location", "intent", "service match"].map((tag) => (
                <span
                  key={tag}
                  className="font-mono text-[10.5px] uppercase tracking-wide text-medium-gray border border-white/10 rounded-full px-3 py-1.5"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
