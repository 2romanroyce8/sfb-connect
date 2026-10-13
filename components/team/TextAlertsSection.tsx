"use client";

import { useCallback, useEffect, useState } from "react";

// Text alerts (Roman, 2026-10-12): phone + carrier once, per-trigger toggles,
// a real test text, and "I received it". Below: the last deliveries with
// their real status so nothing about this is a guess.
type Carrier = { key: string; label: string; gateway: string | null; status: string; note: string };
type Trigger = { key: string; label: string; hint: string };
type Settings = { notify_phone: string | null; notify_carrier: string | null; notify_prefs: Record<string, boolean> | null; notify_sms_verified_at: string | null; notify_sms_last_bounce_at: string | null; notify_sms_last_bounce_reason: string | null };
type Delivery = { id: string; trigger: string; channel: string; to_address: string | null; body: string | null; status: string; reason: string | null; provider_last_event: string | null; created_at: string };
type Data = { settings: Settings; carriers: Carrier[]; triggers: Trigger[]; deliveries: Delivery[]; resendConfigured: boolean };

const input: React.CSSProperties = { background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" };
const fmtPhone = (p: string | null) => (p && p.length === 10 ? `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}` : p ?? "");
const STATUS_COLOR: Record<string, string> = { active: "#30D158", unconfirmed: "#FFD60A", sunsetting: "#FF9F0A", shutdown: "#FF453A", none: "#8E8E93" };

export default function TextAlertsSection() {
  const [data, setData] = useState<Data | null>(null);
  const [phone, setPhone] = useState(""); const [carrierKey, setCarrierKey] = useState(""); const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false); const [testMsg, setTestMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/team/notifications/sms", { cache: "no-store" }); if (!r.ok) return;
    const j = (await r.json()) as Data; setData(j);
    setPhone(fmtPhone(j.settings.notify_phone)); setCarrierKey(j.settings.notify_carrier ?? ""); setPrefs(j.settings.notify_prefs ?? {});
  }, []);
  useEffect(() => { void load(); }, [load]);

  const post = async (body: Record<string, unknown>) => { const r = await fetch("/api/team/notifications/sms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "Request failed."); return j; };

  const save = async () => {
    setSaving(true); setMsg(null);
    try { const j = await post({ action: "save", phone, carrier: carrierKey || null, prefs }); setMsg(j.gateway ? `Saved. Texts go to ${j.gateway}.${j.changed ? " Send a test text to confirm it arrives." : ""}` : carrierKey ? `Saved. ${j.carrier?.note ?? ""} Alerts for you go to email.` : "Saved. Add a number and carrier to get texts; alerts go to email until then."); await load(); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Could not save."); } finally { setSaving(false); }
  };
  const test = async () => {
    setTesting(true); setTestMsg(null);
    try { const j = await post({ action: "test" }); setTestMsg(j.lastEvent === "delivered" ? `Sent to ${j.gateway} — Resend reports delivered to the carrier gateway. Check your phone, then tap "I received it".` : j.lastEvent === "bounced" ? `Sent to ${j.gateway} — the gateway BOUNCED it. This carrier's email-to-text is not working for your line; alerts go to email for 7 days.` : `Sent to ${j.gateway} (Resend: ${j.lastEvent ?? "no delivery event yet"}). Check your phone, then tap "I received it".`); await load(); }
    catch (e) { setTestMsg(e instanceof Error ? e.message : "Test failed."); } finally { setTesting(false); }
  };
  const verify = async () => { try { await post({ action: "verify" }); setTestMsg("Confirmed — alerts now go by text (the call-now alert also always emails)."); await load(); } catch (e) { setTestMsg(e instanceof Error ? e.message : "Could not confirm."); } };

  if (!data) return <div className="text-[12.5px] text-[#6E6E73]">Loading…</div>;
  const c = data.carriers.find((x) => x.key === carrierKey) ?? null; const s = data.settings;
  const gatewayLive = Boolean(s.notify_phone && c?.gateway);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12.5px] text-[#6E6E73] leading-relaxed">Alerts reach you by text through your carrier&apos;s email-to-text address (no new paid service), with email as the fallback. Notifications only — this path never sends outreach. Until you confirm a test text arrived, every alert also goes to your email.</p>
      {!data.resendConfigured && <div className="text-[12.5px] text-[#FF9F9A]">Resend is not configured in this environment — nothing can send.</div>}
      <div className="grid sm:grid-cols-2 gap-3">
        <div><label className="text-[11px] uppercase tracking-wide text-[#6E6E73]">Mobile number</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(213) 523-1641" inputMode="tel" className="w-full h-[38px] rounded-[8px] px-3 text-[13px] outline-none mt-1" style={input} /></div>
        <div><label className="text-[11px] uppercase tracking-wide text-[#6E6E73]">Carrier</label>
          <select value={carrierKey} onChange={(e) => setCarrierKey(e.target.value)} className="w-full h-[38px] rounded-[8px] px-3 text-[13px] outline-none mt-1" style={input}>
            <option value="">Not set (email only)</option>
            {data.carriers.map((x) => <option key={x.key} value={x.key}>{x.label}{x.status === "shutdown" ? " — gateway shut down" : x.status === "sunsetting" ? " — shutting down" : x.status === "unconfirmed" ? " — unconfirmed" : ""}</option>)}
          </select></div>
      </div>
      {c && <div className="text-[12px] rounded-[8px] px-3 py-2" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${STATUS_COLOR[c.status]}55` }}><span style={{ color: STATUS_COLOR[c.status] }}>●</span> {c.note}{c.gateway && s.notify_phone ? <span className="text-[#6E6E73]"> Address: <span className="font-mono">{s.notify_phone}@{c.gateway}</span></span> : null}</div>}
      <div>
        <div className="text-[11px] uppercase tracking-wide text-[#6E6E73] mb-2">What to text me about</div>
        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-2.5 text-[13px] opacity-80"><input type="checkbox" checked readOnly disabled className="mt-0.5" /><span><span className="text-[#F5F5F7]">Call-now (15–30-minute callback promise)</span><span className="text-[#6E6E73]"> — always on: text + email + in-app, instantly.</span></span></label>
          {data.triggers.map((t) => <label key={t.key} className="flex items-start gap-2.5 text-[13px] cursor-pointer"><input type="checkbox" checked={prefs[t.key] ?? true} onChange={(e) => setPrefs((p) => ({ ...p, [t.key]: e.target.checked }))} className="mt-0.5" /><span><span className="text-[#F5F5F7]">{t.label}</span><span className="text-[#6E6E73]"> — {t.hint}</span></span></label>)}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={save} disabled={saving} className="h-[34px] px-4 rounded-[8px] bg-white text-black text-[12.5px] font-semibold disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
        {msg && <span className="text-[12px] text-[#A1A1A6]">{msg}</span>}
      </div>
      <div className="rounded-[10px] p-3.5" style={{ background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={test} disabled={testing || !gatewayLive} className="h-[32px] px-3.5 rounded-[8px] text-[12px] font-semibold disabled:opacity-50" style={{ background: "#1c1c1e", color: "#F5F5F7", border: "1px solid rgba(255,255,255,0.1)" }}>{testing ? "Sending…" : "Send me a test text"}</button>
          {gatewayLive && !s.notify_sms_verified_at && <button onClick={verify} className="h-[32px] px-3.5 rounded-[8px] text-[12px] font-semibold bg-[#30D158] text-black">I received it</button>}
          <span className="text-[12px] text-[#A1A1A6]">{s.notify_sms_verified_at ? `Verified ${new Date(s.notify_sms_verified_at).toLocaleString()}.` : gatewayLive ? "Not verified yet — alerts also go to email." : "Save a number and carrier with a live gateway to test."}</span>
        </div>
        {s.notify_sms_last_bounce_at && <div className="text-[12px] text-[#FF9F9A] mt-2">Last text bounced ({s.notify_sms_last_bounce_reason}) {new Date(s.notify_sms_last_bounce_at).toLocaleString()} — alerts are going to email for 7 days.</div>}
        {testMsg && <div className="text-[12px] text-[#A1A1A6] mt-2">{testMsg}</div>}
      </div>
      {data.deliveries.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-[#6E6E73] mb-2">Recent deliveries</div>
          <div className="flex flex-col gap-1">
            {data.deliveries.map((d) => <div key={d.id} className="grid text-[11.5px] gap-2 py-1" style={{ gridTemplateColumns: "72px 50px 1fr 90px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <span className="text-[#6E6E73]">{new Date(d.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              <span className="text-[#A1A1A6]">{d.channel}</span>
              <span className="truncate text-[#D4D4D4]" title={`${d.trigger}${d.to_address ? ` → ${d.to_address}` : ""}: ${d.body ?? ""}`}>{d.trigger}{d.to_address ? ` → ${d.to_address}` : ""}</span>
              <span style={{ color: d.status === "sent" ? (d.provider_last_event === "bounced" ? "#FF453A" : "#30D158") : d.status === "failed" ? "#FF453A" : "#FF9F0A" }}>{d.status}{d.provider_last_event ? ` · ${d.provider_last_event}` : ""}{d.reason && d.status !== "sent" ? ` · ${d.reason}` : ""}</span>
            </div>)}
          </div>
        </div>
      )}
    </div>
  );
}
