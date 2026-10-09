"use client";

import Link from "next/link";
import { trackMarketingEvent } from "@/lib/marketingEvents";

export default function CapabilityCardLink({ capabilityKey, children }: { capabilityKey: string; children: React.ReactNode }) {
  return (
    <Link href="/agent#capabilities" onClick={() => trackMarketingEvent("capability_card_click", { capability: capabilityKey })} className="block rounded-[14px] p-5 hover:bg-white/[0.03] transition-colors" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
      {children}
    </Link>
  );
}
