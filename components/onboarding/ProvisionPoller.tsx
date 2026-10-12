"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** After payment, the webhook provisions the account within seconds. Re-render the server page until it has. */
export default function ProvisionPoller() {
  const router = useRouter();
  const [ticks, setTicks] = useState(0);
  useEffect(() => { const id = setInterval(() => { setTicks((t) => t + 1); router.refresh(); }, 3000); return () => clearInterval(id); }, [router]);
  return (
    <div className="rounded-[12px] p-4 text-[14px]" style={{ background: "rgba(48,209,88,0.08)", border: "1px solid rgba(48,209,88,0.35)" }}>
      <div className="font-semibold">Setting up your account…</div>
      <div className="text-white/[0.6] mt-1">Payment received. Your workspace unlocks the moment Stripe confirms it to us — usually within a minute.{ticks > 20 ? " Taking longer than usual? Email hello@sfbconnect.com and we'll finish it by hand." : ""}</div>
    </div>
  );
}
