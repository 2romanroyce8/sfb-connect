"use client";

import { useState } from "react";
import type { RevenueAnalytics } from "@/lib/team/analytics/types";
import RevenueAnalyticsView from "./RevenueAnalyticsView";
import CompanyAnalyticsView from "./CompanyAnalyticsView";
import StripeMirrorView from "./StripeMirrorView";

type Tab = "sales" | "company" | "stripe";

/** Analytics page: Sales (per-rep revenue events) · Company (our records) · Stripe mirror (read-only). Company + Stripe are owner-only. */
export default function AnalyticsTabs({ initial, isOwner, stripeConfigured }: { initial: RevenueAnalytics; isOwner: boolean; stripeConfigured: boolean }) {
  const [tab, setTab] = useState<Tab>("sales");
  const tabs: { key: Tab; label: string; hint: string; show: boolean }[] = [
    { key: "sales", label: "Sales", hint: "Closed deals by rep and plan", show: true },
    { key: "company", label: "Company", hint: "Collected revenue, clients, MRR, pipeline — from our records", show: isOwner },
    { key: "stripe", label: "Stripe mirror", hint: "Read-only reflection of the Stripe dashboard", show: isOwner },
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="inline-flex items-center gap-0.5 p-[3px] rounded-[10px] self-start" style={{ background: "var(--hx-121212)", border: "1px solid rgb(var(--w) / 0.06)" }}>
        {tabs.filter((t) => t.show).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} title={t.hint} className="h-8 px-4 rounded-[7px] text-[12.5px] font-medium transition-colors" style={tab === t.key ? { background: "var(--hx-f5f5f7)", color: "var(--hx-090909)" } : { color: "var(--hx-a1a1a6)" }}>{t.label}</button>
        ))}
      </div>
      {tab === "sales" && <RevenueAnalyticsView initial={initial} isOwner={isOwner} />}
      {tab === "company" && isOwner && <CompanyAnalyticsView />}
      {tab === "stripe" && isOwner && <StripeMirrorView configured={stripeConfigured} />}
    </div>
  );
}
