"use client";
import { useEffect, useRef, useState } from "react";
import DemoStage from "@/components/mk/DemoStage";
import type { Trade } from "@/lib/mk/trades";

type Ev = "demo_opened" | "session_started" | "chat_started" | "voice_started" | "audit_requested" | "cta_clicked";
export default function PublicDemo({ agency, slug, trade, cta }: { agency: string; slug: string; trade: Trade; cta: { href: string; label: string } | null }) {
  const session = useRef<string | null>(null); const fired = useRef<Set<string>>(new Set()); const [ready, setReady] = useState(false);
  // Anonymous analytics: one random session id per browser tab (sessionStorage, no cookies). Each event type is counted once per session except CTA clicks.
  async function send(event: Ev) {
    if (event !== "cta_clicked" && fired.current.has(event)) return; fired.current.add(event);
    try { const r = await fetch("/api/demo/event", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ agency, slug, event, session: session.current }), keepalive: true }); const j = await r.json().catch(() => ({})); if (j.session) { session.current = j.session; try { sessionStorage.setItem(`demo:${agency}/${slug}`, j.session); } catch { /* storage blocked */ } } } catch { /* analytics must never break the demo */ }
  }
  useEffect(() => { try { session.current = sessionStorage.getItem(`demo:${agency}/${slug}`); } catch { /* ignore */ } void send("demo_opened").then(() => setReady(true)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  return (
    <div>
      <div className="rounded-[14px] px-4 py-3 text-[12.5px] mb-6" style={{ background: "var(--mk-bg2)", border: "1px solid var(--mk-border)", color: "var(--mk-muted)" }}>
        This page counts visits and button clicks (not who you are) so {trade.biz.length ? "the agency that sent it" : "the sender"} can see whether it was useful. No ad tracking and no cookies. Live voice calls use your microphone only after you press the button.
      </div>
      <DemoStage showTrades={false} fixedTrade={trade} demo={{ agency, slug }} onEvent={(e) => void send(e)} />
      {cta && <div className="mt-8 text-center"><a href={cta.href} target={cta.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" onClick={() => void send("cta_clicked")} className="mk-btn mk-btn-primary">{cta.label}</a></div>}
      <span hidden data-ready={ready} />
    </div>
  );
}
