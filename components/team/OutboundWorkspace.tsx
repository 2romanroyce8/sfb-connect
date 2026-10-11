"use client";

import { useCallback, useEffect, useState } from "react";

type Biz = { id: string; legal_name: string; is_sandbox: boolean; plan_key: string | null; outbound_offer_line: string | null; outbound_time_zone: string };
type Prospect = { id: string; name: string; contact_name: string | null; website: string | null; email: string | null; email_source: string | null; phone_e164: string | null; city: string | null; state: string | null; category: string | null; status: string; enriched_at: string | null; last_contacted_at: string | null };
type Msg = { id: string; prospect_id: string; direction: "out" | "in"; step: number; to_email: string | null; subject: string | null; body_text: string | null; template_key: string | null; status: string; approved_by: string | null; approved_at: string | null; sent_at: string | null; opened_at: string | null; replied_at: string | null; rejected_reason: string | null; error: string | null; created_at: string; created_by: string };
type Ev = { id: string; kind: string; actor: string; payload: Record<string, unknown>; prospect_id: string | null; created_at: string };
type Booking = { id: string; prospect_id: string; start_at: string; end_at: string; meet_url: string | null; status: string; calendar_event_id: string | null };
type Finding = { id: string; business_name: string; website: string | null; city: string | null; state: string | null; category: string; identity_label: string };
type State = { businesses: Biz[]; business: Biz | null; prospects: Prospect[]; messages: Msg[]; events: Ev[]; bookings: Booking[]; findings: Finding[]; credits: { balance: number; allotment: number; monthly_remaining: number; topup_balance: number } | null };

const card: React.CSSProperties = { background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" };
const btn = "h-[32px] px-3 rounded-[8px] text-[12px] font-semibold disabled:opacity-50";
const primary = `${btn} bg-white text-black`;
const ghost = `${btn} text-[#F5F5F7]`;
const ghostStyle = { border: "1px solid rgba(255,255,255,0.14)" };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
const STATUS: Record<string, string> = { pending_approval: "#FFD60A", approved: "#0A84FF", sent: "#30D158", simulated: "#30D158", received: "#A1A1A6", rejected: "#FF453A", failed: "#FF453A", bounced: "#FF453A", draft: "#6E6E73", sourced: "#6E6E73", enriched: "#0A84FF", in_sequence: "#FFD60A", replied: "#30D158", booked: "#30D158", unsubscribed: "#FF453A" };

/**
 * Outbound workspace: prospects → enrich → sequence → approval queue → sent/opened/replied → book.
 * The approval column is the gate: nothing leaves without a click here (or the customer's, Phase 2).
 */
export default function OutboundWorkspace() {
  const [s, setS] = useState<State | null>(null);
  const [biz, setBiz] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"queue" | "prospects" | "activity">("queue");
  const [open, setOpen] = useState<Msg | null>(null);
  const [newP, setNewP] = useState({ name: "", website: "", email: "", contact_name: "" });
  const [offer, setOffer] = useState("");
  const [slots, setSlots] = useState<{ start: string; end: string }[] | null>(null);

  const load = useCallback(async (b?: string | null) => {
    const r = await fetch(`/api/team/outbound${b ? `?business=${b}` : ""}`, { cache: "no-store" });
    if (!r.ok) { setErr("Could not load outbound."); return; }
    const j = (await r.json()) as State; setS(j); setBiz(j.business?.id ?? null); setOffer(j.business?.outbound_offer_line ?? "");
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = async (payload: Record<string, unknown>, key: string) => {
    setBusy(key); setErr(null);
    try {
      const r = await fetch("/api/team/outbound", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ business_id: biz, ...payload }) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || "Failed."); return null; }
      await load(biz); return j;
    } finally { setBusy(null); }
  };

  if (!s) return <div className="text-[12px] text-[#6E6E73]">{err ?? "Loading outbound…"}</div>;
  if (!s.business) return <div className="rounded-[12px] p-5 text-[13px] text-[#A1A1A6]" style={card}>No business with a plan yet. Outbound runs per customer business (Solo/Agency, or a trial in simulated mode).</div>;

  const pending = s.messages.filter((m) => m.status === "pending_approval");
  const byId = Object.fromEntries(s.prospects.map((p) => [p.id, p]));
  const sentCount = s.messages.filter((m) => m.status === "sent" || m.status === "simulated").length;
  const openedCount = s.messages.filter((m) => m.opened_at).length;
  const repliedCount = s.messages.filter((m) => m.replied_at).length;

  return (
    <div className="flex flex-col gap-5 max-w-[1200px]">
      <div className="flex flex-wrap items-center gap-3">
        <select value={biz ?? ""} onChange={(e) => void load(e.target.value)} className="h-[34px] rounded-[8px] px-2 text-[12.5px] bg-[#0F0F0F] text-[#F5F5F7]" style={ghostStyle}>{s.businesses.map((b) => <option key={b.id} value={b.id}>{b.legal_name}{b.is_sandbox ? " · trial (simulated sends)" : ""}</option>)}</select>
        {s.credits && <span className="text-[12px] text-[#A1A1A6]">Credits <span className="text-[#F5F5F7] font-semibold">{s.credits.monthly_remaining} / {s.credits.allotment}</span>{s.credits.topup_balance > 0 ? ` + ${s.credits.topup_balance} top-up` : ""}</span>}
        <span className="text-[12px] text-[#6E6E73]">· {sentCount} sent · {openedCount} opened · {repliedCount} replied · {s.bookings.length} booked</span>
        <button onClick={() => act({ action: "sync" }, "sync")} disabled={busy === "sync"} className={ghost} style={ghostStyle}>{busy === "sync" ? "Syncing…" : "Sync replies & steps"}</button>
      </div>
      {err && <div className="rounded-[10px] p-3 text-[12.5px] text-[#FF6961]" style={{ background: "rgba(255,69,58,0.08)" }}>{err}</div>}

      {/* Offer line: the one approved sentence every intro uses. Without it nothing can be drafted. */}
      <div className="rounded-[12px] p-4" style={card}>
        <div className="text-[12px] font-semibold text-[#F5F5F7]">Approved offer line <span className="font-normal text-[#6E6E73]">— the one sentence every intro email uses. No line, no drafts.</span></div>
        <div className="mt-2 flex gap-2"><input value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="e.g. We replace roofs for property managers in Oklahoma City with a 48-hour quote turnaround." className="flex-1 h-[36px] rounded-[8px] px-3 text-[13px] bg-[#0F0F0F] text-[#F5F5F7] outline-none" style={ghostStyle} /><button onClick={() => act({ action: "set_offer_line", offer_line: offer }, "offer")} disabled={busy === "offer"} className={primary}>Save</button></div>
      </div>

      <div className="flex gap-2">{(["queue", "prospects", "activity"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`${btn} ${tab === t ? "bg-white text-black" : "text-[#A1A1A6]"}`} style={tab === t ? undefined : ghostStyle}>{t === "queue" ? `Approval queue (${pending.length})` : t === "prospects" ? `Prospects (${s.prospects.length})` : "Activity"}</button>)}</div>

      {tab === "queue" && (
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-4">
          <div className="flex flex-col gap-2">
            {pending.length === 0 && <div className="rounded-[12px] p-5 text-[13px] text-[#6E6E73]" style={card}>Nothing waiting. Drafts land here the moment the agent (or a sequence step) writes one.</div>}
            {pending.map((m) => (
              <button key={m.id} onClick={() => setOpen(m)} className="text-left rounded-[12px] p-4" style={{ ...card, borderColor: open?.id === m.id ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)" }}>
                <div className="flex items-center justify-between gap-3"><div className="text-[13px] font-semibold text-[#F5F5F7] truncate">{byId[m.prospect_id]?.name ?? "Prospect"} <span className="font-normal text-[#6E6E73]">· {m.to_email}</span></div><span className="text-[10.5px] uppercase tracking-wide" style={{ color: STATUS[m.status] }}>{m.template_key ?? `step ${m.step}`}</span></div>
                <div className="text-[12px] text-[#A1A1A6] mt-1 truncate">{m.subject}</div>
                <div className="text-[11px] text-[#6E6E73] mt-1">drafted {fmt(m.created_at)} by {m.created_by}</div>
              </button>
            ))}
          </div>
          <div className="rounded-[12px] p-5" style={card}>
            {!open ? <div className="text-[13px] text-[#6E6E73]">Select a message to review. Approve sends it from the owner&apos;s Gmail (trial businesses: simulated). Every approval is a 5-credit human review pass.</div> : (
              <>
                <div className="text-[11px] uppercase tracking-wide text-[#6E6E73]">To</div><div className="text-[13px] text-[#F5F5F7]">{open.to_email}</div>
                <div className="mt-3 text-[11px] uppercase tracking-wide text-[#6E6E73]">Subject</div><div className="text-[13px] text-[#F5F5F7]">{open.subject}</div>
                <div className="mt-3 text-[11px] uppercase tracking-wide text-[#6E6E73]">Body</div><pre className="mt-1 whitespace-pre-wrap text-[13px] leading-[1.55] text-[#E5E5EA] font-sans">{open.body_text}</pre>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={async () => { const r = await act({ action: "approve", message_id: open.id, and_send: true }, open.id); if (r) setOpen(null); }} disabled={busy === open.id} className={primary}>{busy === open.id ? "Sending…" : s.business.is_sandbox ? "Approve (simulate send)" : "Approve & send"}</button>
                  <button onClick={async () => { const reason = prompt("Why? (kept on the record)") ?? ""; if (!reason) return; const r = await act({ action: "reject", message_id: open.id, reason }, `rej-${open.id}`); if (r) setOpen(null); }} className={ghost} style={{ ...ghostStyle, color: "#FF6961" }}>Reject</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {tab === "prospects" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-[12px] p-4 grid md:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2" style={card}>
            <input value={newP.name} onChange={(e) => setNewP({ ...newP, name: e.target.value })} placeholder="Business name *" className="h-[34px] rounded-[8px] px-3 text-[12.5px] bg-[#0F0F0F] text-[#F5F5F7] outline-none" style={ghostStyle} />
            <input value={newP.website} onChange={(e) => setNewP({ ...newP, website: e.target.value })} placeholder="Website" className="h-[34px] rounded-[8px] px-3 text-[12.5px] bg-[#0F0F0F] text-[#F5F5F7] outline-none" style={ghostStyle} />
            <input value={newP.email} onChange={(e) => setNewP({ ...newP, email: e.target.value })} placeholder="Email (if known)" className="h-[34px] rounded-[8px] px-3 text-[12.5px] bg-[#0F0F0F] text-[#F5F5F7] outline-none" style={ghostStyle} />
            <input value={newP.contact_name} onChange={(e) => setNewP({ ...newP, contact_name: e.target.value })} placeholder="Contact name (if public)" className="h-[34px] rounded-[8px] px-3 text-[12.5px] bg-[#0F0F0F] text-[#F5F5F7] outline-none" style={ghostStyle} />
            <button onClick={async () => { const r = await act({ action: "add_prospect", ...newP }, "add"); if (r) setNewP({ name: "", website: "", email: "", contact_name: "" }); }} disabled={!newP.name || busy === "add"} className={primary}>Add</button>
          </div>
          {s.findings.length > 0 && (
            <details className="rounded-[12px] p-4" style={card}><summary className="cursor-pointer text-[12.5px] text-[#A1A1A6]">Import from the research feed ({s.findings.length} accepted findings)</summary>
              <ul className="mt-3 flex flex-col gap-1.5">{s.findings.map((f) => <li key={f.id} className="flex items-center justify-between gap-3 text-[12.5px]"><span className="text-[#F5F5F7] truncate">{f.business_name} <span className="text-[#6E6E73]">· {f.city}, {f.state} · {f.category} · {f.identity_label}</span></span><button onClick={() => act({ action: "import_findings", finding_ids: [f.id] }, `imp-${f.id}`)} className={ghost} style={ghostStyle}>Import</button></li>)}</ul>
            </details>
          )}
          <div className="rounded-[12px] overflow-x-auto" style={card}>
            <table className="w-full text-[12.5px]"><thead><tr className="text-left text-[#6E6E73]"><th className="px-4 py-2 font-medium">Prospect</th><th className="px-4 py-2 font-medium">Contact</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium text-right">Actions</th></tr></thead><tbody>
              {s.prospects.length === 0 ? <tr><td colSpan={4} className="px-4 py-6 text-[#6E6E73]">No prospects yet. Add one above or import from the feed.</td></tr> : s.prospects.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <td className="px-4 py-2.5"><div className="text-[#F5F5F7] font-medium">{p.name}</div><div className="text-[11px] text-[#6E6E73]">{p.website ?? "no website"}{p.city ? ` · ${p.city}, ${p.state}` : ""}</div></td>
                  <td className="px-4 py-2.5 text-[#A1A1A6]">{p.email ? <span className="text-[#F5F5F7]">{p.email} <span className="text-[#6E6E73]">({p.email_source})</span></span> : <span className="text-[#6E6E73]">no email yet</span>}{p.phone_e164 ? <div className="text-[11px]">{p.phone_e164}</div> : null}</td>
                  <td className="px-4 py-2.5"><span className="text-[11px] uppercase tracking-wide" style={{ color: STATUS[p.status] ?? "#A1A1A6" }}>{p.status.replace("_", " ")}</span></td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => act({ action: "enrich", prospect_id: p.id }, `en-${p.id}`)} disabled={busy === `en-${p.id}` || !p.website} className={ghost} style={ghostStyle} title="Reads their site for email/phone/city · 2 credits (0 if nothing found)">{busy === `en-${p.id}` ? "Reading…" : "Enrich"}</button>{" "}
                    <button onClick={() => act({ action: "start_sequence", prospect_id: p.id }, `seq-${p.id}`)} disabled={busy === `seq-${p.id}` || !p.email || p.status === "in_sequence" || p.status === "unsubscribed"} className={ghost} style={ghostStyle} title="Drafts the intro (2 credits) → approval queue; follow-ups draft on day 3 and 7">Start sequence</button>{" "}
                    <button onClick={async () => { const r = await act({ action: "slots" }, `sl-${p.id}`); if (r?.slots) setSlots(r.slots.map((x: { start: string; end: string }) => ({ ...x, prospect: p.id })) as never); }} disabled={busy === `sl-${p.id}`} className={ghost} style={ghostStyle} title="Open slots on the owner's calendar">Book…</button>
                  </td>
                </tr>
              ))}
            </tbody></table>
          </div>
          {slots && (
            <div className="rounded-[12px] p-4" style={card}><div className="text-[12.5px] text-[#F5F5F7] mb-2">Pick a slot (15 min, {s.business.outbound_time_zone}). Books on the owner&apos;s Google Calendar · 5 credits · confirmation email goes to the approval queue.</div>
              <div className="flex flex-wrap gap-2">{slots.map((sl) => <button key={sl.start} onClick={async () => { const pid = (sl as unknown as { prospect: string }).prospect; const r = await act({ action: "book", prospect_id: pid, start: sl.start, end: sl.end }, "book"); if (r) setSlots(null); }} className={ghost} style={ghostStyle}>{new Date(sl.start).toLocaleString("en-US", { timeZone: s.business!.outbound_time_zone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</button>)}<button onClick={() => setSlots(null)} className={ghost} style={ghostStyle}>Cancel</button></div></div>
          )}
        </div>
      )}

      {tab === "activity" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-[12px]" style={card}><div className="px-4 py-3 text-[12px] font-semibold text-[#F5F5F7]">Messages</div>
            <ul className="divide-y divide-white/[0.06]">{s.messages.slice(0, 60).map((m) => <li key={m.id} className="px-4 py-2.5 text-[12.5px]"><div className="flex items-center justify-between gap-3"><span className="text-[#F5F5F7] truncate">{m.direction === "in" ? "↩ " : ""}{byId[m.prospect_id]?.name ?? "Prospect"} <span className="text-[#6E6E73]">· {m.subject}</span></span><span className="text-[10.5px] uppercase tracking-wide shrink-0" style={{ color: STATUS[m.status] ?? "#A1A1A6" }}>{m.status.replace("_", " ")}</span></div><div className="text-[11px] text-[#6E6E73]">{m.sent_at ? `sent ${fmt(m.sent_at)}` : fmt(m.created_at)}{m.opened_at ? ` · opened ${fmt(m.opened_at)}` : ""}{m.replied_at ? ` · replied ${fmt(m.replied_at)}` : ""}{m.rejected_reason ? ` · ${m.rejected_reason}` : ""}{m.error ? ` · ${m.error}` : ""}</div></li>)}</ul></div>
          <div className="flex flex-col gap-4">
            <div className="rounded-[12px]" style={card}><div className="px-4 py-3 text-[12px] font-semibold text-[#F5F5F7]">Bookings</div><ul className="divide-y divide-white/[0.06]">{s.bookings.length === 0 ? <li className="px-4 py-3 text-[12.5px] text-[#6E6E73]">None yet.</li> : s.bookings.map((b) => <li key={b.id} className="px-4 py-2.5 text-[12.5px] text-[#F5F5F7]">{byId[b.prospect_id]?.name ?? "Prospect"} · {fmt(b.start_at)}{b.meet_url ? <a href={b.meet_url} target="_blank" rel="noopener noreferrer" className="ml-2 underline text-[#A1A1A6]">Meet</a> : null}<span className="ml-2 text-[10.5px] uppercase text-[#6E6E73]">{b.status}</span></li>)}</ul></div>
            <div className="rounded-[12px]" style={card}><div className="px-4 py-3 text-[12px] font-semibold text-[#F5F5F7]">Event log</div><ul className="divide-y divide-white/[0.06] max-h-[420px] overflow-auto">{s.events.map((e) => <li key={e.id} className="px-4 py-2 text-[12px]"><span className="text-[#F5F5F7]">{e.kind}</span> <span className="text-[#6E6E73]">· {e.actor} · {fmt(e.created_at)}</span></li>)}</ul></div>
          </div>
        </div>
      )}
    </div>
  );
}
