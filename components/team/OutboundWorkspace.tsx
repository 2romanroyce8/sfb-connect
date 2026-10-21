"use client";

import { useCallback, useEffect, useState } from "react";
import CsvImport from "@/components/outbound/CsvImport";
import ComposePicker, { type Compose } from "@/components/outbound/ComposePicker";
import { useMultiSelect, SelectCircle, SelectToggle, BulkBar, postJson, type BulkAction } from "@/components/ui/MultiSelect";
import { chunk, plural } from "@/lib/ui/selection";

type Biz = { id: string; legal_name: string; plan_key: string | null; outbound_offer_line: string | null; outbound_time_zone: string };
type Prospect = { id: string; name: string; contact_name: string | null; website: string | null; email: string | null; email_source: string | null; phone_e164: string | null; city: string | null; state: string | null; category: string | null; status: string; enriched_at: string | null; last_contacted_at: string | null; source?: string | null; import_id?: string | null };
type Import = { id: string; filename: string; uploaded_by: string; counts: { imported?: number; skipped?: number; total?: number }; created_at: string };
type Msg = { id: string; prospect_id: string; direction: "out" | "in"; step: number; to_email: string | null; subject: string | null; body_text: string | null; template_key: string | null; template_source?: { subject: string; body: string; label: string } | null; status: string; approved_by: string | null; approved_at: string | null; sent_at: string | null; opened_at: string | null; replied_at: string | null; rejected_reason: string | null; error: string | null; created_at: string; created_by: string };
type Ev = { id: string; kind: string; actor: string; payload: Record<string, unknown>; prospect_id: string | null; created_at: string };
type Booking = { id: string; prospect_id: string; start_at: string; end_at: string; meet_url: string | null; status: string; calendar_event_id: string | null };
type Finding = { id: string; business_name: string; website: string | null; city: string | null; state: string | null; category: string; identity_label: string };
type State = { businesses: Biz[]; business: Biz | null; prospects: Prospect[]; messages: Msg[]; events: Ev[]; bookings: Booking[]; findings: Finding[]; credits: { balance: number; allotment: number; monthly_remaining: number; topup_balance: number } | null; imports?: Import[] };

const card: React.CSSProperties = { background: "var(--hx-0a0a0a)", border: "1px solid rgb(var(--w) / 0.08)" };
const btn = "h-[32px] px-3 rounded-[8px] text-[12px] font-semibold disabled:opacity-50";
const primary = `${btn} bg-white text-black`;
const ghost = `${btn} text-[color:var(--hx-f5f5f7)]`;
const ghostStyle = { border: "1px solid rgb(var(--w) / 0.14)" };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
const STATUS: Record<string, string> = { pending_approval: "var(--hx-ffd60a)", approved: "var(--hx-0a84ff)", sent: "var(--hx-30d158)", simulated: "var(--hx-30d158)", received: "var(--hx-a1a1a6)", rejected: "var(--hx-ff453a)", failed: "var(--hx-ff453a)", bounced: "var(--hx-ff453a)", draft: "var(--hx-6e6e73)", sourced: "var(--hx-6e6e73)", enriched: "var(--hx-0a84ff)", in_sequence: "var(--hx-ffd60a)", replied: "var(--hx-30d158)", booked: "var(--hx-30d158)", unsubscribed: "var(--hx-ff453a)" };

/**
 * Outbound workspace: prospects → enrich → sequence → approval queue → sent/opened/replied → book.
 * The approval column is the gate: nothing leaves without a click here (or the customer's, Phase 2).
 */
export default function OutboundWorkspace() {
  const [s, setS] = useState<State | null>(null);
  const [biz, setBiz] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<"queue" | "prospects" | "activity">("queue");
  const [open, setOpen] = useState<Msg | null>(null);
  const [newP, setNewP] = useState({ name: "", website: "", email: "", contact_name: "" });
  const [offer, setOffer] = useState("");
  const [slots, setSlots] = useState<{ start: string; end: string }[] | null>(null);
  const [cv, setCv] = useState<{ id: string; label: string }[]>([]);
  const [compose, setCompose] = useState<Compose | null>(null); const [saveFor, setSaveFor] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async (b?: string | null) => {
    const r = await fetch(`/api/team/outbound${b ? `?business=${b}` : ""}`, { cache: "no-store" });
    if (!r.ok) { setErr("Could not load outbound."); return; }
    const j = (await r.json()) as State & { campaignVariants?: { id: string; label: string }[] }; setS(j); setCv(j.campaignVariants ?? []); setBiz(j.business?.id ?? null); setOffer(j.business?.outbound_offer_line ?? "");
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = async (payload: Record<string, unknown>, key: string) => {
    setBusy(key); setErr(null); setNotice(null);
    try {
      const r = await fetch("/api/team/outbound", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ business_id: biz, ...payload }) });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || "Failed."); return null; }
      if (j.message?.held_until) setNotice(`Approved — held for the send window (${j.message.held_label}). It sends automatically inside the window.`);
      await load(biz); return j;
    } finally { setBusy(null); }
  };

  // ---------- multi-select (2026-10-19) ----------
  const pendingIds = (s?.messages ?? []).filter((m) => m.status === "pending_approval").map((m) => m.id);
  const msQ = useMultiSelect(pendingIds);
  const msP = useMultiSelect((s?.prospects ?? []).map((p) => p.id));
  const msA = useMultiSelect((s?.messages ?? []).slice(0, 60).map((m) => m.id));
  const bulk = (body: Record<string, unknown>) => postJson("/api/team/outbound", { business_id: biz, ...body });
  const emails = (n: number) => plural(n, "email");
  const delMsgs = (ms: typeof msQ): BulkAction => ({ label: "Delete", tone: "danger", confirm: (n) => `Delete ${emails(n)}?`, run: async (ids) => { const j = await bulk({ action: "bulk_delete_messages", message_ids: ids }); setOpen(null); await load(biz); return `${emails(j.deleted)} deleted`; } });
  const queueActions: BulkAction[] = [
    { label: "Approve All", tone: "primary", confirm: (n) => `Approve ${emails(n)}?`, run: async (ids) => {
      let approved = 0, held = 0, sent = 0, sendFailed = 0; const errors: string[] = [];
      for (const part of chunk(ids, 10)) { const j = await bulk({ action: "bulk_approve", message_ids: part }); approved += j.approved; held += j.held; sent += j.sent; sendFailed += j.sendFailed; errors.push(...j.errors); }
      setOpen(null); await load(biz);
      return [`${emails(approved)} approved`, held ? `${held} held for the send window` : "", sent ? `${sent} sent` : "", sendFailed ? `${sendFailed} failed to send (retry in queue)` : "", errors.length ? `${errors.length} not approved: ${errors[0]}` : ""].filter(Boolean).join(" · ");
    } },
    delMsgs(msQ),
  ];
  const prospectActions: BulkAction[] = [
    { label: "Start sequence", tone: "primary", confirm: (n) => `Start sequences for ${plural(n, "prospect")}? This drafts ${plural(n, "intro email")} into the approval queue (2 credits each on client businesses). Nothing sends until a human approves each one.`, run: async (ids) => {
      const tpl = compose && compose.mode !== "agent" && !(compose.mode === "custom" && (!compose.custom?.subject.trim() || !compose.custom?.body.trim())) ? { template: compose.template, custom: compose.custom } : {};
      let started = 0; let stopped = false; const skipped: { name: string; reason: string }[] = [];
      for (const part of chunk(ids, 25)) { const j = await bulk({ action: "bulk_start_sequence", prospect_ids: part, ...tpl }); started += j.started; skipped.push(...j.skipped); if (j.stoppedForCredits) { stopped = true; break; } }
      await load(biz);
      return [`${plural(started, "sequence")} started — first emails are in the approval queue (nothing sent)`, skipped.length ? `${skipped.length} not started (${skipped[0].name}: ${skipped[0].reason}${skipped.length > 1 ? ` +${skipped.length - 1} more` : ""})` : "", stopped ? "stopped: out of credits" : ""].filter(Boolean).join(" · ");
    } },
    ...(cv.length ? [{ label: "Add to campaign", options: cv.map((v) => ({ label: v.label, value: v.id })), confirm: (n: number) => `Draft the campaign email for ${plural(n, "prospect")}?`, run: async (ids: string[], v?: string) => {
      let drafted = 0; const skipped: string[] = [];
      for (const part of chunk(ids, 10)) { const j = await bulk({ action: "bulk_add_to_campaign", prospect_ids: part, variant_id: v }); drafted += j.drafted; skipped.push(...j.skipped); }
      await load(biz); return `${emails(drafted)} drafted into the approval queue${skipped.length ? ` · ${skipped.length} skipped (${skipped[0]})` : ""}`;
    } }] : []),
    { label: "Delete", tone: "danger", confirm: (n) => `Delete ${plural(n, "prospect")}? Their emails go too.`, run: async (ids) => { const j = await bulk({ action: "bulk_delete_prospects", prospect_ids: ids }); await load(biz); return `${plural(j.deleted, "prospect")} deleted`; } },
  ];

  if (!s) return <div className="text-[12px] text-[color:var(--hx-6e6e73)]">{err ?? "Loading outbound…"}</div>;
  if (!s.business) return <div className="rounded-[12px] p-5 text-[13px] text-[color:var(--hx-a1a1a6)]" style={card}>No business with a plan yet. Outbound runs per customer business (Solo or Agency).</div>;

  const pending = s.messages.filter((m) => m.status === "pending_approval");
  const failed = s.messages.filter((m) => m.status === "failed" && m.approved_by);
  const byId = Object.fromEntries(s.prospects.map((p) => [p.id, p]));
  const sentCount = s.messages.filter((m) => m.status === "sent" || m.status === "simulated").length;
  const openedCount = s.messages.filter((m) => m.opened_at).length;
  const repliedCount = s.messages.filter((m) => m.replied_at).length;

  return (
    <div className="flex flex-col gap-5 max-w-[1200px]">
      <div className="flex flex-wrap items-center gap-3">
        <select value={biz ?? ""} onChange={(e) => void load(e.target.value)} className="h-[34px] rounded-[8px] px-2 text-[12.5px] bg-[color:var(--hx-0f0f0f)] text-[color:var(--hx-f5f5f7)]" style={ghostStyle}>{s.businesses.map((b) => <option key={b.id} value={b.id}>{b.legal_name}</option>)}</select>
        {s.credits && <span className="text-[12px] text-[color:var(--hx-a1a1a6)]">Credits <span className="text-[color:var(--hx-f5f5f7)] font-semibold">{s.credits.monthly_remaining} / {s.credits.allotment}</span>{s.credits.topup_balance > 0 ? ` + ${s.credits.topup_balance} top-up` : ""}</span>}
        <span className="text-[12px] text-[color:var(--hx-6e6e73)]">· {sentCount} sent · {openedCount} opened · {repliedCount} replied · {s.bookings.length} booked</span>
        <button onClick={() => act({ action: "sync" }, "sync")} disabled={busy === "sync"} className={ghost} style={ghostStyle}>{busy === "sync" ? "Syncing…" : "Sync replies & steps"}</button>
      </div>
      {notice && <div className="rounded-[10px] p-3 text-[12.5px] text-[color:var(--hx-30d158)]" style={{ background: "rgba(48,209,88,0.08)" }}>{notice}</div>}
      {err && <div className="rounded-[10px] p-3 text-[12.5px] text-[color:var(--hx-ff6961)]" style={{ background: "rgba(255,69,58,0.08)" }}>{err}</div>}

      {/* Offer line: the one approved sentence every intro uses. Without it nothing can be drafted. */}
      <div className="rounded-[12px] p-4" style={card}>
        <div className="text-[12px] font-semibold text-[color:var(--hx-f5f5f7)]">Approved offer line <span className="font-normal text-[color:var(--hx-6e6e73)]">— the one sentence every intro email uses. No line, no drafts.</span></div>
        <div className="mt-2 flex gap-2"><input value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="e.g. We replace roofs for property managers in Oklahoma City with a 48-hour quote turnaround." className="flex-1 h-[36px] rounded-[8px] px-3 text-[13px] bg-[color:var(--hx-0f0f0f)] text-[color:var(--hx-f5f5f7)] outline-none" style={ghostStyle} /><button onClick={() => act({ action: "set_offer_line", offer_line: offer }, "offer")} disabled={busy === "offer"} className={primary}>Save</button></div>
      </div>

      <div className="flex gap-2">{(["queue", "prospects", "activity"] as const).map((t) => <button key={t} onClick={() => { setTab(t); msQ.cancel(); msP.cancel(); msA.cancel(); }} className={`${btn} ${tab === t ? "bg-white text-black" : "text-[color:var(--hx-a1a1a6)]"}`} style={tab === t ? undefined : ghostStyle}>{t === "queue" ? `Approval queue (${pending.length})` : t === "prospects" ? `Prospects (${s.prospects.length})` : "Activity"}</button>)}</div>

      {tab === "queue" && (
        <div className="flex flex-col gap-4">
        <details className="rounded-[12px] p-4" style={card}><summary className="cursor-pointer text-[12.5px] text-[color:var(--hx-a1a1a6)]">Compose &amp; templates — what new sequences say{compose ? ` (current: ${compose.label})` : ""}</summary>
          <div className="mt-3"><ComposePicker target={{ kind: "team", businessId: s.business.id }} dark onChange={setCompose} /></div>
          <div className="mt-3 text-[11.5px] text-[color:var(--hx-6e6e73)]">“Start sequence” on the Prospects tab uses the intro chosen here (or your own email if “Write my own” is selected and filled in).</div>
        </details>
        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-4">
          <div className="flex flex-col gap-2">
            {pending.length > 0 && <div className="flex items-center justify-between"><span className="text-[12px] text-[color:var(--hx-6e6e73)]">{pending.length} waiting for approval</span><SelectToggle ms={msQ} total={pending.length} noun="emails" /></div>}
            {pending.length === 0 && <div className="rounded-[12px] p-5 text-[13px] text-[color:var(--hx-6e6e73)]" style={card}>Nothing waiting. Drafts land here the moment the agent (or a sequence step) writes one.</div>}
            {failed.length > 0 && (
              <div className="rounded-[12px] p-4" style={{ ...card, borderColor: "rgba(255,69,58,0.3)" }}>
                <div className="text-[12.5px] font-semibold text-[color:var(--hx-ff6961)]">{failed.length} approved {failed.length === 1 ? "message" : "messages"} failed to send</div>
                {failed.map((m) => <div key={m.id} className="mt-2 flex items-center justify-between gap-3 text-[12px]"><div className="min-w-0"><div className="text-[color:var(--hx-f5f5f7)] truncate">{byId[m.prospect_id]?.name ?? "Prospect"} · {m.to_email}</div><div className="text-[color:var(--hx-a1a1a6)] truncate">{m.error}</div></div><button onClick={() => act({ action: "retry", message_id: m.id }, `retry-${m.id}`)} disabled={busy === `retry-${m.id}`} className={ghost} style={ghostStyle}>{busy === `retry-${m.id}` ? "Sending…" : "Retry send"}</button></div>)}
              </div>
            )}
            {pending.map((m) => (
              <button key={m.id} onClick={() => setOpen(m)} className="text-left rounded-[12px] p-4 flex gap-2" style={{ ...card, borderColor: msQ.isSelected(m.id) ? "var(--hx-0a84ff)" : open?.id === m.id ? "rgb(var(--w) / 0.22)" : "rgb(var(--w) / 0.08)" }}>
                {msQ.active && <SelectCircle checked={msQ.isSelected(m.id)} onToggle={() => msQ.toggle(m.id)} label={`Select email to ${m.to_email}`} />}
                <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3"><div className="text-[13px] font-semibold text-[color:var(--hx-f5f5f7)] truncate">{byId[m.prospect_id]?.name ?? "Prospect"} <span className="font-normal text-[color:var(--hx-6e6e73)]">· {m.to_email}</span></div><span className="text-[10.5px] uppercase tracking-wide" style={{ color: STATUS[m.status] }}>{m.template_key ?? `step ${m.step}`}</span></div>
                <div className="text-[12px] text-[color:var(--hx-a1a1a6)] mt-1 truncate">{m.subject}</div>
                <div className="text-[11px] text-[color:var(--hx-6e6e73)] mt-1">drafted {fmt(m.created_at)} by {m.created_by}</div>
                </div>
              </button>
            ))}
          </div>
          <div className="rounded-[12px] p-5" style={card}>
            {!open ? <div className="text-[13px] text-[color:var(--hx-6e6e73)]">Select a message to review. Approve sends it from the owner&apos;s Gmail. Every approval is a 5-credit human review pass.</div> : (
              <>
                <div className="text-[11px] uppercase tracking-wide text-[color:var(--hx-6e6e73)]">To</div><div className="text-[13px] text-[color:var(--hx-f5f5f7)]">{open.to_email}</div>
                <div className="mt-3 text-[11px] uppercase tracking-wide text-[color:var(--hx-6e6e73)]">Subject</div><div className="text-[13px] text-[color:var(--hx-f5f5f7)]">{open.subject}</div>
                <div className="mt-3 text-[11px] uppercase tracking-wide text-[color:var(--hx-6e6e73)]">Body</div><pre className="mt-1 whitespace-pre-wrap text-[13px] leading-[1.55] text-[color:var(--hx-e5e5ea)] font-sans">{open.body_text}</pre>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={async () => { const r = await act({ action: "approve", message_id: open.id, and_send: true }, open.id); if (r) setOpen(null); }} disabled={busy === open.id} className={primary}>{busy === open.id ? "Approving…" : "Approve & send"}</button>
                  <button onClick={async () => { const reason = prompt("Why? (kept on the record)") ?? ""; if (!reason) return; const r = await act({ action: "reject", message_id: open.id, reason }, `rej-${open.id}`); if (r) setOpen(null); }} className={ghost} style={{ ...ghostStyle, color: "var(--hx-ff6961)" }}>Reject</button>
                </div>
              </>
            )}
          </div>
        </div>
        </div>
      )}

      {tab === "prospects" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-[12px] p-4 grid md:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2" style={card}>
            <input value={newP.name} onChange={(e) => setNewP({ ...newP, name: e.target.value })} placeholder="Business name *" className="h-[34px] rounded-[8px] px-3 text-[12.5px] bg-[color:var(--hx-0f0f0f)] text-[color:var(--hx-f5f5f7)] outline-none" style={ghostStyle} />
            <input value={newP.website} onChange={(e) => setNewP({ ...newP, website: e.target.value })} placeholder="Website" className="h-[34px] rounded-[8px] px-3 text-[12.5px] bg-[color:var(--hx-0f0f0f)] text-[color:var(--hx-f5f5f7)] outline-none" style={ghostStyle} />
            <input value={newP.email} onChange={(e) => setNewP({ ...newP, email: e.target.value })} placeholder="Email (if known)" className="h-[34px] rounded-[8px] px-3 text-[12.5px] bg-[color:var(--hx-0f0f0f)] text-[color:var(--hx-f5f5f7)] outline-none" style={ghostStyle} />
            <input value={newP.contact_name} onChange={(e) => setNewP({ ...newP, contact_name: e.target.value })} placeholder="Contact name (if public)" className="h-[34px] rounded-[8px] px-3 text-[12.5px] bg-[color:var(--hx-0f0f0f)] text-[color:var(--hx-f5f5f7)] outline-none" style={ghostStyle} />
            <button onClick={async () => { const r = await act({ action: "add_prospect", ...newP }, "add"); if (r) setNewP({ name: "", website: "", email: "", contact_name: "" }); }} disabled={!newP.name || busy === "add"} className={primary}>Add</button>
          </div>
          <details className="rounded-[12px] p-4" style={card}><summary className="cursor-pointer text-[12.5px] text-[color:var(--hx-a1a1a6)]">Upload a CSV list{s.imports?.length ? ` (${s.imports.length} upload${s.imports.length === 1 ? "" : "s"} so far)` : ""}</summary>
            <div className="mt-3"><CsvImport target={{ kind: "team", businessId: s.business.id }} dark onImported={() => void load(biz)} /></div>
            {s.imports && s.imports.length > 0 && <ul className="mt-3 text-[12px] text-[color:var(--hx-6e6e73)] flex flex-col gap-0.5">{s.imports.map((i) => <li key={i.id}>Uploaded · <span className="text-[color:var(--hx-a1a1a6)]">{i.filename}</span> · {fmt(i.created_at)} · {i.uploaded_by} · {i.counts.imported ?? 0} imported{i.counts.skipped ? `, ${i.counts.skipped} skipped` : ""}</li>)}</ul>}
          </details>
          {s.findings.length > 0 && (
            <details className="rounded-[12px] p-4" style={card}><summary className="cursor-pointer text-[12.5px] text-[color:var(--hx-a1a1a6)]">Import from the research feed ({s.findings.length} accepted findings)</summary>
              <ul className="mt-3 flex flex-col gap-1.5">{s.findings.map((f) => <li key={f.id} className="flex items-center justify-between gap-3 text-[12.5px]"><span className="text-[color:var(--hx-f5f5f7)] truncate">{f.business_name} <span className="text-[color:var(--hx-6e6e73)]">· {f.city}, {f.state} · {f.category} · {f.identity_label}</span></span><button onClick={() => act({ action: "import_findings", finding_ids: [f.id] }, `imp-${f.id}`)} className={ghost} style={ghostStyle}>Import</button></li>)}</ul>
            </details>
          )}
          <div className="rounded-[12px] overflow-x-auto" style={card}>
            <div className="flex items-center justify-between px-4 pt-3"><span className="text-[12px] text-[color:var(--hx-6e6e73)]">{s.prospects.length} prospects</span><SelectToggle ms={msP} total={s.prospects.length} noun="prospects" /></div>
            <table className="w-full text-[12.5px]"><thead><tr className="text-left text-[color:var(--hx-6e6e73)]">{msP.active && <th className="w-[44px]" />}<th className="px-4 py-2 font-medium">Prospect</th><th className="px-4 py-2 font-medium">Contact</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium text-right">Actions</th></tr></thead><tbody>
              {s.prospects.length === 0 ? <tr><td colSpan={4} className="px-4 py-6 text-[color:var(--hx-6e6e73)]">No prospects yet. Add one above or import from the feed.</td></tr> : s.prospects.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid rgb(var(--w) / 0.06)", background: msP.isSelected(p.id) ? "rgba(10,132,255,0.08)" : undefined }}>
                  {msP.active && <td className="pl-3 w-[44px]"><SelectCircle checked={msP.isSelected(p.id)} onToggle={() => msP.toggle(p.id)} label={`Select ${p.name}`} /></td>}
                  <td className="px-4 py-2.5"><div className="text-[color:var(--hx-f5f5f7)] font-medium">{p.name}{p.source === "upload" && <span className="ml-2 text-[10px] uppercase tracking-wide rounded-full px-1.5 py-0.5 align-middle" style={{ background: "rgba(10,132,255,0.15)", color: "var(--hx-6fb3ff)" }} title={(() => { const i = s.imports?.find((x) => x.id === p.import_id); return i ? `Uploaded · ${i.filename} · ${fmt(i.created_at)}` : "Uploaded"; })()}>Uploaded{(() => { const i = s.imports?.find((x) => x.id === p.import_id); return i ? ` · ${i.filename}` : ""; })()}</span>}</div><div className="text-[11px] text-[color:var(--hx-6e6e73)]">{p.contact_name && p.contact_name !== p.name ? `${p.contact_name} · ` : ""}{p.website ?? "no website"}{p.city ? ` · ${p.city}, ${p.state}` : ""}</div></td>
                  <td className="px-4 py-2.5 text-[color:var(--hx-a1a1a6)]">{p.email ? <span className="text-[color:var(--hx-f5f5f7)]">{p.email} <span className="text-[color:var(--hx-6e6e73)]">({p.email_source})</span></span> : <span className="text-[color:var(--hx-6e6e73)]">no email yet</span>}{p.phone_e164 ? <div className="text-[11px]">{p.phone_e164}</div> : null}</td>
                  <td className="px-4 py-2.5"><span className="text-[11px] uppercase tracking-wide" style={{ color: STATUS[p.status] ?? "var(--hx-a1a1a6)" }}>{p.status.replace("_", " ")}</span></td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button onClick={() => act({ action: "enrich", prospect_id: p.id }, `en-${p.id}`)} disabled={busy === `en-${p.id}` || !p.website} className={ghost} style={ghostStyle} title="Reads their site for email/phone/city · 2 credits (0 if nothing found)">{busy === `en-${p.id}` ? "Reading…" : "Enrich"}</button>{" "}
                    <button onClick={() => act({ action: "start_sequence", prospect_id: p.id, ...(compose && compose.mode !== "agent" && !(compose.mode === "custom" && (!compose.custom?.subject.trim() || !compose.custom?.body.trim())) ? { template: compose.template, custom: compose.custom } : {}) }, `seq-${p.id}`)} disabled={busy === `seq-${p.id}` || !p.email || p.status === "in_sequence" || p.status === "unsubscribed"} className={ghost} style={ghostStyle} title="Drafts the intro (2 credits) → approval queue; follow-ups draft on day 3 and 7">Start sequence</button>{" "}
                    <button onClick={async () => { const r = await act({ action: "slots" }, `sl-${p.id}`); if (r?.slots) setSlots(r.slots.map((x: { start: string; end: string }) => ({ ...x, prospect: p.id })) as never); }} disabled={busy === `sl-${p.id}`} className={ghost} style={ghostStyle} title="Open slots on the owner's calendar">Book…</button>
                  </td>
                </tr>
              ))}
            </tbody></table>
          </div>
          {slots && (
            <div className="rounded-[12px] p-4" style={card}><div className="text-[12.5px] text-[color:var(--hx-f5f5f7)] mb-2">Pick a slot (15 min, {s.business.outbound_time_zone}). Books on the owner&apos;s Google Calendar · 5 credits · confirmation email goes to the approval queue.</div>
              <div className="flex flex-wrap gap-2">{slots.map((sl) => <button key={sl.start} onClick={async () => { const pid = (sl as unknown as { prospect: string }).prospect; const r = await act({ action: "book", prospect_id: pid, start: sl.start, end: sl.end }, "book"); if (r) setSlots(null); }} className={ghost} style={ghostStyle}>{new Date(sl.start).toLocaleString("en-US", { timeZone: s.business!.outbound_time_zone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</button>)}<button onClick={() => setSlots(null)} className={ghost} style={ghostStyle}>Cancel</button></div></div>
          )}
        </div>
      )}

      {tab === "activity" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-[12px]" style={card}><div className="px-4 py-3 text-[12px] font-semibold text-[color:var(--hx-f5f5f7)] flex items-center justify-between">Messages<SelectToggle ms={msA} total={Math.min(60, s.messages.length)} noun="emails" /></div>
            <ul className="divide-y divide-white/[0.06]">{s.messages.slice(0, 60).map((m) => <li key={m.id} className="px-4 py-2.5 text-[12.5px] flex gap-2" style={{ background: msA.isSelected(m.id) ? "rgba(10,132,255,0.08)" : undefined }}>{msA.active && <SelectCircle checked={msA.isSelected(m.id)} onToggle={() => msA.toggle(m.id)} />}<div className="flex-1 min-w-0"><div className="flex items-center justify-between gap-3"><span className="text-[color:var(--hx-f5f5f7)] truncate">{m.direction === "in" ? "↩ " : ""}{byId[m.prospect_id]?.name ?? "Prospect"} <span className="text-[color:var(--hx-6e6e73)]">· {m.subject}</span></span><span className="text-[10.5px] uppercase tracking-wide shrink-0" style={{ color: STATUS[m.status] ?? "var(--hx-a1a1a6)" }}>{m.status.replace("_", " ")}</span></div><div className="text-[11px] text-[color:var(--hx-6e6e73)]">{m.sent_at ? `sent ${fmt(m.sent_at)}` : fmt(m.created_at)}{m.opened_at ? ` · opened ${fmt(m.opened_at)}` : ""}{m.replied_at ? ` · replied ${fmt(m.replied_at)}` : ""}{m.rejected_reason ? ` · ${m.rejected_reason}` : ""}{m.error ? ` · ${m.error}` : ""}{m.template_key ? ` · ${m.template_key}` : ""}{m.direction === "out" && (m.status === "sent" || m.status === "approved") && !m.template_key?.startsWith("saved:") ? <> · <button onClick={() => setSaveFor({ id: m.id, name: "" })} className="underline text-[color:var(--hx-a1a1a6)]">save as preset</button></> : null}</div></div></li>)}</ul>
            {saveFor && <div className="px-4 py-3 flex items-center gap-2 flex-wrap" style={{ borderTop: "1px solid rgb(var(--w) / 0.06)" }}><input autoFocus value={saveFor.name} onChange={(e) => setSaveFor({ ...saveFor, name: e.target.value })} placeholder="Name this preset" className="h-[32px] rounded-[8px] px-3 text-[12.5px] bg-[color:var(--hx-0f0f0f)] text-[color:var(--hx-f5f5f7)] outline-none" style={ghostStyle} /><button onClick={async () => { const r = await act({ action: "template_save", name: saveFor.name, message_id: saveFor.id, category: "saved" }, "tsave"); if (r) setSaveFor(null); }} disabled={!saveFor.name.trim() || busy === "tsave"} className={primary}>{busy === "tsave" ? "Saving…" : "Save"}</button><button onClick={() => setSaveFor(null)} className={ghost} style={ghostStyle}>Cancel</button></div>}</div>
          <div className="flex flex-col gap-4">
            <div className="rounded-[12px]" style={card}><div className="px-4 py-3 text-[12px] font-semibold text-[color:var(--hx-f5f5f7)]">Bookings</div><ul className="divide-y divide-white/[0.06]">{s.bookings.length === 0 ? <li className="px-4 py-3 text-[12.5px] text-[color:var(--hx-6e6e73)]">None yet.</li> : s.bookings.map((b) => <li key={b.id} className="px-4 py-2.5 text-[12.5px] text-[color:var(--hx-f5f5f7)]">{byId[b.prospect_id]?.name ?? "Prospect"} · {fmt(b.start_at)}{b.meet_url ? <a href={b.meet_url} target="_blank" rel="noopener noreferrer" className="ml-2 underline text-[color:var(--hx-a1a1a6)]">Meet</a> : null}<span className="ml-2 text-[10.5px] uppercase text-[color:var(--hx-6e6e73)]">{b.status}</span></li>)}</ul></div>
            <div className="rounded-[12px]" style={card}><div className="px-4 py-3 text-[12px] font-semibold text-[color:var(--hx-f5f5f7)]">Event log</div><ul className="divide-y divide-white/[0.06] max-h-[420px] overflow-auto">{s.events.map((e) => <li key={e.id} className="px-4 py-2 text-[12px]"><span className="text-[color:var(--hx-f5f5f7)]">{e.kind}</span> <span className="text-[color:var(--hx-6e6e73)]">· {e.actor} · {fmt(e.created_at)}</span></li>)}</ul></div>
          </div>
        </div>
      )}
      {tab === "queue" && <BulkBar ms={msQ} noun={emails} actions={queueActions} />}
      {tab === "prospects" && <BulkBar ms={msP} noun={(n) => plural(n, "prospect")} actions={prospectActions} />}
      {tab === "activity" && <BulkBar ms={msA} noun={emails} actions={[delMsgs(msA)]} />}
      {(msQ.active || msP.active || msA.active) && <div className="h-[96px]" />}
    </div>
  );
}
