"use client";

import Link from "next/link";
import { Check, Loader2, AlertCircle, Lock } from "lucide-react";
import type { AgentModule } from "@/lib/agentProgram/modules";
import { buildRows } from "@/lib/analyzer/narrate";
import { useScan } from "@/lib/analyzer/client";
import { trackMarketingEvent } from "@/lib/marketingEvents";
import { initialOf } from "@/lib/analyzer/identity";
import { useState } from "react";

/**
 * The day-grouped punch list. Every row is a real finding (or an honest
 * "couldn't measure — here's why"); the agent line is status-aware from the
 * capability registry passed in from the server. Rows fill in as the stream
 * lands. The preview promises; the trial shows.
 */
/** Their logo (or a clean initial tile — never a broken image) + their name + "Analyzed: exactly what they typed". */
function ReportHeader({ name, logoUrl, enteredQuery, domain, market, cached, status }: { name: string | null; logoUrl: string | null; enteredQuery: string; domain: string; market: string | null; cached: boolean; status: string }) {
  const [broken, setBroken] = useState(false);
  const showLogo = !!logoUrl && !broken;
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[18px] p-4 md:p-5" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center gap-4 min-w-0">
        <div className="shrink-0 w-[56px] h-[56px] rounded-[14px] flex items-center justify-center overflow-hidden" style={{ background: "#141416", border: "1px solid rgba(255,255,255,0.1)" }}>
          {showLogo ? <img src={logoUrl!} alt={name ? `${name} logo` : "Logo"} className="w-full h-full object-contain p-1.5" onError={() => setBroken(true)} /> : <span className="text-[22px] font-semibold text-white/[0.85]">{initialOf(name, domain)}</span>}
        </div>
        <div className="min-w-0">
          <div className="text-[16px] md:text-[18px] font-semibold text-white truncate">{name ?? domain}</div>
          <div className="text-[12.5px] text-white/[0.55] truncate">Analyzed: <span className="text-white/[0.8]">{enteredQuery}</span>{market ? <span> · {market}</span> : null}</div>
        </div>
      </div>
      <div className="text-[12px] text-white/[0.4]">{status}{cached ? " · scanned in the last 24h" : ""}</div>
    </div>
  );
}

function Heading({ name }: { name: string | null }) {
  return (
    <div className="max-w-[860px] mb-10">
      <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-5 block">What your agent would do first</span>
      <h2 className="text-[32px] sm:text-[40px] md:text-[56px] font-extrabold tracking-[-0.025em] leading-[1.06]">
        Your agent&apos;s first 7 days{name ? <> at <span className="font-serif-accent italic font-normal">{name}.</span></> : <span className="font-serif-accent italic font-normal">.</span>}
      </h2>
      <p className="mt-4 text-[15px] leading-relaxed text-[#a3a3a8]">Real findings from public data, grouped by day. Live capabilities act in the trial; the rest tell you when they ship. <a href="#agent" className="underline underline-offset-2 text-white/[0.85]">See all 8 →</a></p>
    </div>
  );
}

export default function FirstSevenDays({ modules }: { modules: AgentModule[] }) {
  const s = useScan();
  if (s.phase === "idle") {
    return (
      <>
        <Heading name={null} />
        <div className="rounded-[18px] p-8 text-center" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[15px] text-white/[0.6]">Enter your website above. In about 30 seconds you&apos;ll see exactly what your agent would do in its first 7 days — from public data, nothing invented.</div>
        </div>
      </>
    );
  }
  if (s.phase === "error" && s.error) {
    return (
      <>
        <Heading name={null} />
        <div className="rounded-[18px] p-6 flex items-start gap-3" style={{ background: "rgba(255,69,58,0.06)", border: "1px solid rgba(255,69,58,0.25)" }}>
          <AlertCircle size={18} className="shrink-0 mt-0.5 text-[#FF6B6B]" />
          <div><div className="text-[14px] font-medium text-white">We couldn&apos;t run the scan.</div><div className="text-[13px] text-white/[0.6] mt-1">{s.error.message}</div></div>
        </div>
      </>
    );
  }
  const rows = buildRows(s.findings, modules);
  const liveFound = s.findings.filter((f) => f.status === "found" && modules.find((m) => m.key === f.capability)?.status === "live").length;
  const scanParam = s.meta?.domain ? `?scan=${encodeURIComponent(s.meta.domain)}` : "";
  const name = s.meta?.businessName ?? null;
  return (
    <div className="flex flex-col gap-4">
      <Heading name={name} />
      <ReportHeader name={name} logoUrl={s.meta?.logoUrl ?? null} enteredQuery={s.meta?.enteredQuery ?? s.query} domain={s.meta?.domain ?? s.query} market={s.meta?.market ?? null} cached={!!s.meta?.cached} status={s.phase === "running" ? "Scanning public data…" : `Public data only · ${s.findings.length} checks`} />

      <ol className="rounded-[18px] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        {rows.map((r, i) => (
          <li key={r.check} className="grid md:grid-cols-[150px_1fr] gap-3 md:gap-6 px-5 md:px-6 py-5" style={{ background: i % 2 ? "#0A0A0A" : "#0D0D0D", borderTop: i ? "1px solid rgba(255,255,255,0.06)" : undefined }}>
            <div>
              <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#30D158]">{r.dayLabel}</div>
              <div className="mt-1 text-[16px] font-semibold text-white">{r.title}</div>
              <div className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-medium rounded-full px-2 py-0.5" style={{ background: r.live ? "rgba(48,209,88,0.12)" : "rgba(255,255,255,0.06)", color: r.live ? "#30D158" : "#8E8E93" }}>{r.live ? <Check size={10} /> : <Lock size={10} />}{r.live ? "Live" : "Not shipped yet"}</div>
            </div>
            <div className="min-w-0">
              {!r.finding ? (
                <div className="flex items-center gap-2 text-[14px] text-white/[0.45]"><Loader2 size={14} className="animate-spin" />Checking…</div>
              ) : (
                <>
                  <div className="text-[15px] md:text-[16px] text-white leading-[1.4]">{r.finding.headline}</div>
                  {r.finding.items.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1">{r.finding.items.map((it) => <li key={it} className="text-[13px] text-white/[0.65] pl-3 relative before:content-[''] before:absolute before:left-0 before:top-[9px] before:w-[5px] before:h-[5px] before:rounded-full before:bg-white/[0.3]">{it}</li>)}</ul>
                  )}
                  {r.finding.reason && <div className="mt-2 text-[12.5px] text-white/[0.42]">{r.finding.status === "missing" ? "Why: " : ""}{r.finding.reason}</div>}
                  {r.agentLine && <div className="mt-3 text-[13.5px] font-medium" style={{ color: r.live ? "#30D158" : "rgba(255,255,255,0.7)" }}>→ {r.agentLine}</div>}
                </>
              )}
            </div>
          </li>
        ))}
      </ol>

      {s.phase === "done" && (
        <div className="rounded-[18px] p-6 flex flex-wrap items-center justify-between gap-4" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div>
            <div className="text-[16px] font-semibold text-white">The preview shows findings. The trial is where the agent acts.</div>
            <div className="text-[13px] text-white/[0.55] mt-1">{liveFound > 0 ? `Your first ${Math.min(3, liveFound)} task${Math.min(3, liveFound) === 1 ? "" : "s"} in the trial mirror what's above on live capabilities.` : "Live capabilities act in the trial; the rest queue for when they ship."} Free, no card.</div>
          </div>
          <Link href={`/start${scanParam}`} onClick={() => trackMarketingEvent("trial_signup_start", { from: "first_7_days", domain: s.meta?.domain })} className="inline-flex items-center bg-white text-black px-6 py-3.5 rounded-full text-[14px] font-semibold hover:opacity-85 transition-opacity">Start free trial — put the agent to work →</Link>
        </div>
      )}
    </div>
  );
}
