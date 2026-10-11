"use client";

import { useState } from "react";

/** Signed-in, no business yet: re-opens the $1 trial checkout for the latest unpaid order. */
export default function TrialResume({ label = "Finish your $1 trial →", dark = true }: { label?: string; dark?: boolean }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/trial/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const j = (await r.json()) as { checkoutUrl?: string; redirect?: string; error?: string; needsSetup?: boolean };
      if (j.redirect) { window.location.href = j.redirect; return; }
      if (j.needsSetup) { window.location.href = "/start"; return; }
      if (!r.ok || !j.checkoutUrl) throw new Error(j.error || "Could not open checkout.");
      window.location.href = j.checkoutUrl;
    } catch (e) { setError(e instanceof Error ? e.message : "Could not open checkout."); setBusy(false); }
  };
  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={go} disabled={busy} className={`h-[46px] px-6 rounded-full text-[14px] font-semibold disabled:opacity-50 ${dark ? "bg-white text-black" : "bg-neutral-900 text-white"}`}>{busy ? "Opening checkout…" : label}</button>
      {error && <div className={`text-[12.5px] ${dark ? "text-[#FF9F9A]" : "text-red-700"}`}>{error}</div>}
    </div>
  );
}
