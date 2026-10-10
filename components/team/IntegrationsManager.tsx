"use client";

import { useCallback, useEffect, useState } from "react";
import type { Integration } from "@/lib/integrations/registry";

type Conn = { provider: string; owner_id: string; account_label: string | null; connected_at: string; status: "active" | "error"; last_error: string | null; owner_name?: string };
type Status = {
  isOwner: boolean; registry: Integration[]; mine: Conn[]; team: Conn[];
  zapierKeys: { id: string; label: string; created_at: string; last_used_at: string | null }[];
  webhookEndpoints: { id: string; url: string; events: string[]; active: boolean; failure_count: number; last_delivery_at: string | null; created_at: string; description: string | null }[];
  inboundTokens: { id: string; label: string; received_count: number; last_received_at: string | null; created_at: string; file_task: boolean }[];
};

const STATUS_COLOR: Record<Integration["status"], string> = { live: "#30D158", needs_setup: "#FFD60A", planned: "#6E6E73" };
const STATUS_LABEL: Record<Integration["status"], string> = { live: "Live", needs_setup: "Needs setup", planned: "Planned" };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "never");
const card: React.CSSProperties = { background: "#0C0C0C", border: "1px solid rgba(255,255,255,0.08)" };
const btn = "h-[32px] px-3 rounded-[8px] text-[12px] font-semibold inline-flex items-center disabled:opacity-50";
const input = "h-[36px] rounded-[8px] px-3 text-[12.5px] outline-none text-white placeholder:text-white/[0.35] w-full";
const inputStyle: React.CSSProperties = { background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.12)" };

/** Every integration in the registry with its real status and a working connect/disconnect for the signed-in member. */
export default function IntegrationsManager() {
  const [s, setS] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ title: string; value: string; note: string } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/team/integrations/status", { cache: "no-store" });
    if (!r.ok) { setErr("Could not load integrations."); return; }
    setS(await r.json()); setErr(null);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const disconnect = async (provider: string) => {
    if (!confirm(`Disconnect ${provider}? Stored tokens are deleted immediately.`)) return;
    await fetch(`/api/team/integrations/${provider}/disconnect`, { method: "POST" }); await load();
  };

  if (!s) return <div className="mt-8 text-[12px] text-[#6E6E73]">{err ?? "Loading integrations…"}</div>;
  const mine = (k: string) => s.mine.find((c) => c.provider === k);

  return (
    <div className="mt-8 max-w-[960px]">
      <div className="text-[14px] font-semibold text-[#F5F5F7]">All integrations</div>
      <div className="text-[12px] text-[#6E6E73] mt-1 mb-3">Status is computed from the environment and real connections — the same registry the public site reads. Only <span className="text-[#30D158]">Live</span> entries appear on sfbconnect.com. Credentials are stored encrypted server-side and never shown again.</div>
      {err && <div className="mb-3 text-[12px] text-[#FF6961]">{err}</div>}
      {reveal && (
        <div className="mb-4 rounded-[10px] p-3" style={{ background: "rgba(48,209,88,0.08)", border: "1px solid rgba(48,209,88,0.3)" }}>
          <div className="text-[12.5px] font-semibold text-[#30D158]">{reveal.title}</div>
          <code className="block mt-1.5 text-[12px] text-[#F5F5F7] break-all select-all">{reveal.value}</code>
          <div className="text-[11.5px] text-[#A1A1A6] mt-1.5">{reveal.note}</div>
          <button onClick={() => setReveal(null)} className="mt-2 text-[11.5px] underline text-[#A1A1A6]">I&apos;ve copied it</button>
        </div>
      )}
      <ul className="flex flex-col gap-2.5">
        {s.registry.map((i) => {
          const c = mine(i.key);
          return (
            <li key={i.key} className="rounded-[12px] p-4" style={card}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  {i.logo ? <img src={i.logo} alt="" className="w-8 h-8 object-contain shrink-0 mt-0.5" /> : <span className="w-8 h-8 rounded-full shrink-0" style={{ border: "1px solid rgba(255,255,255,0.12)" }} />}
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-[#F5F5F7]">{i.name} <span className="ml-2 text-[11px]" style={{ color: STATUS_COLOR[i.status] }}>● {STATUS_LABEL[i.status]}</span></div>
                    <div className="text-[12px] text-[#A1A1A6] mt-0.5">{i.description}</div>
                    {i.blocker && <div className="text-[11.5px] mt-1" style={{ color: "rgba(255,214,10,0.85)" }}>{i.blocker}</div>}
                    {c && <div className="text-[11.5px] text-[#30D158] mt-1">Connected{c.account_label ? ` as ${c.account_label}` : ""} · {fmt(c.connected_at)}{c.status === "error" && <span className="text-[#FF6961]"> · needs reconnect: {c.last_error}</span>}</div>}
                    {s.isOwner && s.team.filter((t) => t.provider === i.key && t.owner_id !== (c?.owner_id ?? "")).map((t) => <div key={t.owner_id} className="text-[11px] text-[#6E6E73] mt-0.5">{t.owner_name}: connected{t.account_label ? ` as ${t.account_label}` : ""}</div>)}
                  </div>
                </div>
                <Actions i={i} connected={!!c} isOwner={s.isOwner} onDisconnect={() => disconnect(i.key)} onReveal={setReveal} reload={load} />
              </div>
              {i.key === "zapier" && s.isOwner && <ZapierPanel keys={s.zapierKeys} reload={load} />}
              {i.key === "webhooks" && s.isOwner && <WebhooksPanel endpoints={s.webhookEndpoints} inbound={s.inboundTokens} reload={load} onReveal={setReveal} />}
              {i.key === "apple_calendar" && !c && <ApplePanel reload={load} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Actions({ i, connected, isOwner, onDisconnect, onReveal, reload }: { i: Integration; connected: boolean; isOwner: boolean; onDisconnect: () => void; onReveal: (r: { title: string; value: string; note: string }) => void; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  if (i.connectKind === "google_calendar") return <a href="#google" className={btn} style={{ border: "1px solid rgba(255,255,255,0.14)", color: "#F5F5F7" }}>Manage above</a>;
  if (i.connectKind === "env") return <span className="text-[11.5px] text-[#6E6E73] font-mono text-right">{i.envVars?.join("\n")}</span>;
  if (i.connectKind === "oauth") {
    const configured = !i.blocker?.startsWith("Register");
    return connected
      ? <button onClick={onDisconnect} className={btn} style={{ background: "rgba(255,69,58,0.12)", color: "#FF6961", border: "1px solid rgba(255,69,58,0.3)" }}>Disconnect</button>
      : <a href={configured ? `/api/team/integrations/${i.key}/connect` : i.consoleUrl} target={configured ? undefined : "_blank"} rel="noopener noreferrer" className={`${btn} ${configured ? "bg-white text-black" : ""}`} style={configured ? undefined : { border: "1px solid rgba(255,255,255,0.14)", color: "#F5F5F7" }}>{configured ? `Connect ${i.name}` : "Open developer console ↗"}</a>;
  }
  if (i.connectKind === "zapier_key") return isOwner ? (
    <button disabled={busy} onClick={async () => { setBusy(true); const r = await fetch("/api/team/integrations/zapier/keys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label: "Zapier" }) }); const j = await r.json(); setBusy(false); if (r.ok) { onReveal({ title: "Zapier API key (shown once)", value: j.key, note: "Paste it into the SFB Connect app in Zapier (API Key auth). Only its hash is stored here." }); await reload(); } }} className={`${btn} bg-white text-black`}>{busy ? "Creating…" : "New API key"}</button>
  ) : <span className="text-[11.5px] text-[#6E6E73]">Owner manages</span>;
  if (i.connectKind === "apple_caldav") return connected ? <button onClick={onDisconnect} className={btn} style={{ background: "rgba(255,69,58,0.12)", color: "#FF6961", border: "1px solid rgba(255,69,58,0.3)" }}>Disconnect</button> : <span className="text-[11.5px] text-[#6E6E73]">Form below</span>;
  return null;
}

function ApplePanel({ reload }: { reload: () => Promise<void> }) {
  const [appleId, setAppleId] = useState(""); const [pw, setPw] = useState(""); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  return (
    <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setMsg(null); const r = await fetch("/api/team/integrations/apple_calendar/connect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ appleId, appPassword: pw }) }); const j = await r.json(); setBusy(false); setPw(""); if (r.ok) { setMsg(`Connected. Calendars: ${(j.calendars as string[]).join(", ") || "found"}`); await reload(); } else setMsg(j.error || "Could not connect."); }} className="mt-3 grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
      <input className={input} style={inputStyle} type="email" required placeholder="Apple ID email" value={appleId} onChange={(e) => setAppleId(e.target.value)} autoComplete="off" />
      <input className={input} style={inputStyle} type="password" required placeholder="App-specific password (xxxx-xxxx-xxxx-xxxx)" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
      <button disabled={busy} className={`${btn} bg-white text-black h-[36px]`}>{busy ? "Verifying…" : "Connect"}</button>
      <div className="sm:col-span-3 text-[11px] text-[#6E6E73]">Create the password at appleid.apple.com → Sign-In and Security → App-Specific Passwords. It is verified against iCloud CalDAV and stored encrypted. {msg && <span className="text-[#F5F5F7]"> {msg}</span>}</div>
    </form>
  );
}

function ZapierPanel({ keys, reload }: { keys: Status["zapierKeys"]; reload: () => Promise<void> }) {
  return (
    <div className="mt-3 text-[12px] text-[#A1A1A6]">
      <div>Auth test: <code className="text-[11px] text-[#F5F5F7]">GET /api/zapier/auth</code> · Subscribe: <code className="text-[11px] text-[#F5F5F7]">POST /api/zapier/subscribe</code> · Samples: <code className="text-[11px] text-[#F5F5F7]">GET /api/zapier/sample/&lt;event&gt;</code> · header <code className="text-[11px] text-[#F5F5F7]">X-API-Key</code>.</div>
      {keys.length > 0 && <ul className="mt-2 flex flex-col gap-1">{keys.map((k) => <li key={k.id} className="flex items-center justify-between"><span>{k.label} · created {fmt(k.created_at)} · last used {fmt(k.last_used_at)}</span><button onClick={async () => { if (confirm("Revoke this Zapier key? Zaps using it stop working.")) { await fetch(`/api/team/integrations/zapier/keys?id=${k.id}`, { method: "DELETE" }); await reload(); } }} className="text-[11px] text-[#FF6961] underline">Revoke</button></li>)}</ul>}
    </div>
  );
}

function WebhooksPanel({ endpoints, inbound, reload, onReveal }: { endpoints: Status["webhookEndpoints"]; inbound: Status["inboundTokens"]; reload: () => Promise<void>; onReveal: (r: { title: string; value: string; note: string }) => void }) {
  const [url, setUrl] = useState(""); const [label, setLabel] = useState(""); const [busy, setBusy] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="mt-3 grid md:grid-cols-2 gap-4 text-[12px] text-[#A1A1A6]">
      <div>
        <div className="font-semibold text-[#F5F5F7]">Outbound</div>
        <form onSubmit={async (e) => { e.preventDefault(); setBusy("out"); const r = await fetch("/api/team/webhooks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create", url }) }); const j = await r.json(); setBusy(null); if (r.ok) { setUrl(""); onReveal({ title: "Webhook signing secret (shown once)", value: j.secret, note: "Verify X-SFB-Signature (t=…,v1=HMAC-SHA256(secret, `${t}.${body}`)) on your receiver." }); await reload(); } else setMsg(j.error); }} className="mt-2 flex gap-2">
          <input className={input} style={inputStyle} type="url" required placeholder="https://your-endpoint.example/hook" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button disabled={busy === "out"} className={`${btn} bg-white text-black h-[36px] shrink-0`}>Add</button>
        </form>
        <ul className="mt-2 flex flex-col gap-1">{endpoints.map((e) => <li key={e.id} className="flex items-center justify-between gap-2"><span className="truncate">{e.url} <span className="text-[#6E6E73]">· {e.events.join(",")} · fails {e.failure_count} · last {fmt(e.last_delivery_at)}</span></span><button onClick={async () => { await fetch(`/api/team/webhooks?id=${e.id}`, { method: "DELETE" }); await reload(); }} className="text-[11px] text-[#FF6961] underline shrink-0">Remove</button></li>)}</ul>
        {endpoints.length > 0 && <button disabled={busy === "test"} onClick={async () => { setBusy("test"); const r = await fetch("/api/team/webhooks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "test" }) }); const j = await r.json(); setBusy(null); setMsg(`Test: ${j.delivered}/${j.attempted} delivered`); await reload(); }} className="mt-2 text-[11.5px] underline text-[#F5F5F7]">Send test event</button>}
      </div>
      <div>
        <div className="font-semibold text-[#F5F5F7]">Inbound</div>
        <form onSubmit={async (e) => { e.preventDefault(); setBusy("in"); const r = await fetch("/api/team/webhooks/inbound", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label }) }); const j = await r.json(); setBusy(null); if (r.ok) { setLabel(""); onReveal({ title: `Inbound URL for "${j.label}" (shown once)`, value: j.url, note: "POST JSON here from any system. Each event is stored and filed as a task for Atlas (HyperAgent reviews)." }); await reload(); } else setMsg(j.error); }} className="mt-2 flex gap-2">
          <input className={input} style={inputStyle} required placeholder="Label, e.g. Website form" value={label} onChange={(e) => setLabel(e.target.value)} />
          <button disabled={busy === "in"} className={`${btn} bg-white text-black h-[36px] shrink-0`}>Create URL</button>
        </form>
        <ul className="mt-2 flex flex-col gap-1">{inbound.map((t) => <li key={t.id} className="flex items-center justify-between gap-2"><span>{t.label} <span className="text-[#6E6E73]">· {t.received_count} received · last {fmt(t.last_received_at)}</span></span><button onClick={async () => { if (confirm("Delete this inbound URL?")) { await fetch(`/api/team/webhooks/inbound?id=${t.id}`, { method: "DELETE" }); await reload(); } }} className="text-[11px] text-[#FF6961] underline shrink-0">Delete</button></li>)}</ul>
      </div>
      {msg && <div className="md:col-span-2 text-[#F5F5F7]">{msg}</div>}
    </div>
  );
}
