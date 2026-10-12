// Google testing-mode gate — server side. Owns google_clearances /
// google_gate_state / google_gate_events and fires the team notifications.
// See lib/google/gate.ts for the rules and docs/runbooks/google-gate.md.
import type { SupabaseClient } from "@supabase/supabase-js";
import { alertOwners, esc } from "@/lib/notify/ownerAlerts";
import { createTask } from "@/lib/agent/tasks/queue";
import { alertsDue, alertMessage, clearancesBlocked, shouldCreateVerificationTask, counterLabel, CONSOLE_TEST_USERS_URL, TEST_USER_CAP, type ClearanceStatus } from "./gate";

export type Clearance = { business_id: string; email: string; status: ClearanceStatus; submitted_at: string; cleared_at: string | null; connected_at: string | null; denied_count: number };
type GateState = { alerts_fired: number[]; verification_task_id: string | null; verification_task_created_at: string | null; clearances_blocked: boolean };

const now = () => new Date().toISOString();

export async function getClearance(service: SupabaseClient, businessId: string): Promise<Clearance | null> {
  const { data } = await service.from("google_clearances").select("business_id, email, status, submitted_at, cleared_at, connected_at, denied_count").eq("business_id", businessId).maybeSingle();
  return (data as Clearance | null) ?? null;
}
export async function getState(service: SupabaseClient): Promise<GateState> {
  const { data } = await service.from("google_gate_state").select("alerts_fired, verification_task_id, verification_task_created_at, clearances_blocked").eq("id", 1).maybeSingle();
  return (data as GateState | null) ?? { alerts_fired: [], verification_task_id: null, verification_task_created_at: null, clearances_blocked: false };
}
/** cleared + connected — both hold a tester slot. */
export async function testUserCount(service: SupabaseClient): Promise<number> {
  const { count } = await service.from("google_clearances").select("business_id", { count: "exact", head: true }).in("status", ["cleared", "connected"]);
  return count ?? 0;
}
export async function isBlocked(service: SupabaseClient): Promise<boolean> {
  const [n, st] = await Promise.all([testUserCount(service), getState(service)]);
  return clearancesBlocked(n, st.clearances_blocked);
}
const logEvent = (service: SupabaseClient, row: { business_id?: string | null; email?: string | null; event: string; detail?: Record<string, unknown> }) => service.from("google_gate_events").insert(row);

/** Step 1 of the gate: the customer tells us the Google address → team is told instantly, button stays gated. */
export async function submitEmail(service: SupabaseClient, business: { id: string; legal_name: string }, email: string, origin: string): Promise<Clearance> {
  const existing = await getClearance(service, business.id);
  if (existing && (existing.status === "cleared" || existing.status === "connected") && existing.email === email) return existing;
  const row = { business_id: business.id, email, status: "email_submitted" as const, submitted_at: now(), cleared_at: null, cleared_by: null, connected_at: null, updated_at: now() };
  const { error } = await service.from("google_clearances").upsert(row, { onConflict: "business_id" });
  if (error) throw new Error(error.message);
  await logEvent(service, { business_id: business.id, email, event: "email_submitted" });
  const blocked = await isBlocked(service);
  // Dashboard task for the team (Atlas by default) + owner alert with the exact address and the console link.
  let taskId: string | null = null;
  try {
    const t = await createTask("hyperagent", {
      title: `Clear Google test user: ${email} (${business.legal_name})`.slice(0, 200), priority: "high", requires_review: false,
      context: `Customer ${business.legal_name} wants to connect Google with ${email}.\n\n1. Open ${CONSOLE_TEST_USERS_URL}\n2. Add ${email} under Test users (≈30 s)\n3. In SFB: /team/integrations → Google test users → Mark cleared${blocked ? "\n\nNOTE: new clearances are currently BLOCKED (cap guard). Do not add until verification completes." : ""}`,
    });
    taskId = t.id;
  } catch (e) { console.error("[google-gate] task create failed:", e instanceof Error ? e.message : e); }
  await alertOwners(service, {
    trigger: "lead_new",
    sms: `Google clearance needed: ${email} (${business.legal_name}). Add as test user, then Mark cleared in SFB.`,
    email: {
      subject: `Clear Google test user: ${email}`,
      html: `<p><strong>${esc(business.legal_name)}</strong> wants to connect Google with:</p><p style="font-size:18px"><strong>${esc(email)}</strong></p><p>1. <a href="${CONSOLE_TEST_USERS_URL}">Open the OAuth consent screen → Test users</a> and add the address (≈30 s).<br/>2. Then <a href="${origin}/team/integrations#google-gate">Mark cleared in SFB</a>.</p>${blocked ? "<p><strong>New clearances are blocked by the cap guard — finish verification first.</strong></p>" : ""}`,
      text: `${business.legal_name} wants to connect Google with ${email}. Add it at ${CONSOLE_TEST_USERS_URL}, then Mark cleared at ${origin}/team/integrations#google-gate.`,
    },
    inApp: { type: "google_gate", title: `Clear Google test user: ${email}`, body: `${business.legal_name} · add in Cloud Console, then Mark cleared`, actionUrl: "/team/integrations#google-gate", actionLabel: "Open gate" },
    detail: { business_id: business.id, task_id: taskId },
  });
  return (await getClearance(service, business.id))!;
}

/** Team flow: the address is on Google's tester list → unlock the customer's Connect button. Refused at the cap guard. */
export async function markCleared(service: SupabaseClient, businessId: string, clearedBy: string): Promise<{ ok: true; clearance: Clearance; count: number } | { ok: false; reason: string }> {
  const c = await getClearance(service, businessId);
  if (!c) return { ok: false, reason: "No Google address submitted for this business yet." };
  if (c.status === "cleared" || c.status === "connected") return { ok: true, clearance: c, count: await testUserCount(service) };
  if (await isBlocked(service)) { await logEvent(service, { business_id: businessId, email: c.email, event: "clearances_blocked" }); return { ok: false, reason: `New clearances are blocked at ${TEST_USER_CAP - (TEST_USER_CAP - 95)}+ test users until Google verification completes.` }; }
  const { error } = await service.from("google_clearances").update({ status: "cleared", cleared_at: now(), cleared_by: clearedBy, updated_at: now() }).eq("business_id", businessId);
  if (error) throw new Error(error.message);
  await logEvent(service, { business_id: businessId, email: c.email, event: "cleared", detail: { by: clearedBy } });
  // Tell the customer the button is live.
  const { data: biz } = await service.from("businesses").select("owner_id, legal_name").eq("id", businessId).single();
  if (biz?.owner_id) {
    const { data: owner } = await service.from("users").select("email").eq("id", biz.owner_id).maybeSingle();
    const { sendEmail } = await import("@/lib/email/resend");
    if (owner?.email) await sendEmail({ to: owner.email as string, subject: "Your Google account is cleared — connect it now", html: `<p>Good news: <strong>${esc(c.email)}</strong> is cleared. Open your dashboard and press <strong>Connect Gmail</strong> / <strong>Connect Google Calendar</strong> — it will go straight through.</p><p><a href="https://www.sfbconnect.com/dashboard/onboarding/gmail">Connect now</a></p>` });
  }
  const count = await afterCountChange(service);
  return { ok: true, clearance: (await getClearance(service, businessId))!, count };
}

/** Called from the OAuth callbacks on a successful Google token exchange for a customer. */
export async function markConnected(service: SupabaseClient, ownerUserId: string, connectedEmail: string | null): Promise<void> {
  const { data: biz } = await service.from("businesses").select("id").eq("owner_id", ownerUserId).not("plan_key", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!biz) return;
  const c = await getClearance(service, biz.id);
  if (!c) { // connected without a clearance row (e.g. team-assisted) — record it so the counter stays honest
    await service.from("google_clearances").insert({ business_id: biz.id, email: (connectedEmail ?? "unknown").toLowerCase(), status: "connected", connected_at: now() });
  } else if (c.status !== "connected") {
    await service.from("google_clearances").update({ status: "connected", connected_at: now(), updated_at: now() }).eq("business_id", biz.id);
  } else return;
  await logEvent(service, { business_id: biz.id, email: connectedEmail ?? c?.email ?? null, event: "connected" });
  await afterCountChange(service);
}

/** Backstop: Google said access_denied to a customer. Log, count, alert the team. Never shows Google's text to the customer. */
export async function recordAccessDenied(service: SupabaseClient, ownerUserId: string | null, origin: string): Promise<void> {
  let businessId: string | null = null; let email: string | null = null; let name = "unknown business";
  if (ownerUserId) {
    const { data: biz } = await service.from("businesses").select("id, legal_name").eq("owner_id", ownerUserId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (biz) { businessId = biz.id; name = biz.legal_name; const c = await getClearance(service, biz.id); email = c?.email ?? null; if (c) await service.from("google_clearances").update({ denied_count: (c.denied_count ?? 0) + 1, last_denied_at: now(), updated_at: now() }).eq("business_id", biz.id); }
    if (!email) { const { data: u } = await service.from("users").select("email").eq("id", ownerUserId).maybeSingle(); email = (u?.email as string) ?? null; }
  }
  await logEvent(service, { business_id: businessId, email, event: "access_denied", detail: { at: now() } });
  await alertOwners(service, {
    trigger: "callback_sla",
    sms: `Google BLOCKED a customer: ${email ?? "unknown"} (${name}). Add as test user now and Mark cleared.`,
    email: { subject: `Google access_denied for ${email ?? "a customer"} — clear them now`, html: `<p>Google refused the OAuth handshake for <strong>${esc(email ?? "unknown")}</strong> (${esc(name)}) at ${now()}.</p><p>The customer saw our friendly holding page, not Google's error. <a href="${CONSOLE_TEST_USERS_URL}">Add the address as a test user</a>, then <a href="${origin}/team/integrations#google-gate">Mark cleared</a>.</p>`, text: `Google access_denied for ${email ?? "unknown"} (${name}) at ${now()}. Add as test user: ${CONSOLE_TEST_USERS_URL}` },
    inApp: { type: "google_gate", title: `Google blocked ${email ?? "a customer"}`, body: `${name} · ${now()}`, actionUrl: "/team/integrations#google-gate", actionLabel: "Open gate" },
    detail: { business_id: businessId },
  });
}

/** Thresholds + verification task, idempotent via google_gate_state. Returns the current count. */
export async function afterCountChange(service: SupabaseClient): Promise<number> {
  const [count, st] = await Promise.all([testUserCount(service), getState(service)]);
  const due = alertsDue(count, st.alerts_fired ?? []);
  for (const t of due) {
    const m = alertMessage(t, count);
    await alertOwners(service, { trigger: "credits_warning", sms: `${m.title}. ${m.body}`, email: { subject: m.title, html: `<p>${esc(m.body)}</p><p>${esc(counterLabel(count))}</p>`, text: `${m.body} ${counterLabel(count)}` }, inApp: { type: "google_gate", title: m.title, body: m.body, actionUrl: "/team/integrations#google-gate", actionLabel: "Open gate" }, detail: { threshold: t, count } });
    await logEvent(service, { event: "threshold_alert", detail: { threshold: t, count } });
  }
  let patch: Record<string, unknown> = {};
  if (due.length) patch.alerts_fired = [...(st.alerts_fired ?? []), ...due];
  if (shouldCreateVerificationTask(count, !!st.verification_task_created_at)) {
    try {
      const t = await createTask("hyperagent", { title: "Start Google OAuth verification + security assessment (testing-mode cap)", priority: "urgent", requires_review: true, context: `Google test users: ${count}/${TEST_USER_CAP}. Gmail uses restricted scopes (gmail.modify) → Google verification + CASA security assessment, weeks to months. Must complete before the 100-user cap binds. Until then the app stays in TESTING MODE on purpose (bridge strategy, 2026-10-12) — do not publish.` });
      patch.verification_task_id = t.id; patch.verification_task_created_at = now();
      await logEvent(service, { event: "verification_task_created", detail: { task_id: t.id, count } });
    } catch (e) { console.error("[google-gate] verification task failed:", e instanceof Error ? e.message : e); }
  }
  if (Object.keys(patch).length) await service.from("google_gate_state").update({ ...patch, updated_at: now() }).eq("id", 1);
  return count;
}

/** Team overview for the counter panel. */
export async function gateOverview(service: SupabaseClient) {
  const [count, st, { data: rows }] = await Promise.all([testUserCount(service), getState(service), service.from("google_clearances").select("business_id, email, status, submitted_at, cleared_at, connected_at, denied_count, businesses(legal_name)").order("submitted_at", { ascending: false }).limit(50)]);
  return { count, cap: TEST_USER_CAP, label: counterLabel(count), blocked: clearancesBlocked(count, st.clearances_blocked), manualBlock: st.clearances_blocked, alertsFired: st.alerts_fired ?? [], verificationTaskId: st.verification_task_id, consoleUrl: CONSOLE_TEST_USERS_URL, rows: (rows ?? []).map((r) => ({ ...(r as object), business_name: (r as { businesses?: { legal_name?: string } | null }).businesses?.legal_name ?? null })) };
}
