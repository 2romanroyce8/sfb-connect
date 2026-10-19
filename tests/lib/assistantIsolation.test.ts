// Client data isolation: two businesses (A = signed-in client, B = another client) in one fake DB.
// Every client intent runs as A; nothing from B may come back, no team table may be touched,
// and confirmed writes aimed at B's rows must be refused.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runClient, executeClient, briefingClient, CLIENT_TABLES, type ClientDeps } from "../../lib/assistant/client";
import { route, CLIENT_INTENTS } from "../../lib/assistant/router";

const A = "aaaaaaaa-0000-0000-0000-00000000000a", B = "bbbbbbbb-0000-0000-0000-00000000000b", UA = "user-a", UB = "user-b";
const MA = "11111111-1111-1111-1111-111111111111", MB = "22222222-2222-2222-2222-222222222222";
const seed: Record<string, Record<string, unknown>[]> = {
  businesses: [{ id: A, owner_id: UA, outbound_offer_line: "A offer" }, { id: B, owner_id: UB, outbound_offer_line: "B SECRET offer" }],
  outbound_prospects: [{ business_id: A, name: "Alpha Roofing", email: "a@alpha.com", city: "Austin", status: "sourced", updated_at: "2026-10-18" }, { business_id: B, name: "Bravo SECRET", email: "b@bravo.com", city: "Boise", status: "sourced", updated_at: "2026-10-18" }],
  outbound_messages: [
    { id: MA, business_id: A, status: "pending_approval", to_email: "a@alpha.com", subject: "A draft", body_text: "hi", created_at: "2026-10-18", direction: "out" },
    { id: MB, business_id: B, status: "pending_approval", to_email: "b@bravo.com", subject: "B SECRET draft", body_text: "hi", created_at: "2026-10-18", direction: "out" },
    { business_id: B, status: "sent", to_email: "x@b.com", subject: "B SECRET sent", sent_at: "2026-10-18T12:00:00Z", direction: "out" },
    { business_id: B, direction: "in", subject: "B SECRET reply", body_text: "yes", created_at: "2026-10-18T12:00:00Z" },
  ],
  outbound_bookings: [{ business_id: B, start_at: "2099-01-01T00:00:00Z", meet_url: "SECRET" }],
  credit_transactions: [{ business_id: B, type: "USAGE", amount: -999, action_key: "SECRET", created_at: new Date().toISOString() }],
};

type Q = { table: string; filters: [string, string, unknown][] };
function fakeDb(log: Q[]) {
  return { from(table: string) {
    const q: Q = { table, filters: [] }; log.push(q);
    const rows = () => (seed[table] ?? []).filter((r) => q.filters.every(([op, k, v]) => op === "eq" ? r[k] === v : op === "in" ? (v as unknown[]).includes(r[k]) : op === "ilike" ? String(r[k] ?? "").toLowerCase().includes(String(v).replace(/%/g, "").toLowerCase()) : op === "gte" ? String(r[k] ?? "") >= String(v) : op === "lt" ? String(r[k] ?? "") < String(v) : true));
    const api: Record<string, unknown> = {};
    for (const m of ["select", "order", "limit", "not", "contains", "or", "is", "update", "insert"]) api[m] = () => api;
    for (const op of ["eq", "in", "ilike", "gte", "lt"]) api[op] = (k: string, v: unknown) => { q.filters.push([op, k, v]); return api; };
    api.maybeSingle = async () => ({ data: rows()[0] ?? null, error: null });
    api.single = async () => ({ data: rows()[0] ?? null, error: null });
    api.then = (res: (x: unknown) => unknown) => res({ data: rows(), count: rows().length, error: null });
    return api;
  } };
}

const deps = (log: Q[]): ClientDeps => ({
  db: fakeDb(log) as never,
  ctx: { businessId: A, userId: UA, businessName: "Alpha Co", planLabel: "Solo", label: "Alice" },
  onboarding: async () => ({ current: 2, percent: 20, completed: false, remaining: [{ no: 2, slug: "gmail", title: "Connect Gmail", short: "…", locked: false }] }),
  credits: async () => ({ balance: 100, allotment: 150, monthlySpent: 50, monthlyRemaining: 100, topupBalance: 0 }),
  prices: [{ key: "outbound.message_written", label: "Message written", credits: 2 }],
  connections: async () => [{ provider: "gmail", status: "active", account_label: "a@alpha.com" }],
});
const sign = () => "tok";
const QUERIES = ["how many credits do I have", "what did I spend", "my plan", "how much does it cost", "any emails waiting for approval", "what did you send", "any replies", "show my meetings", "is gmail connected", "what's my offer line", "how is it going", "how many prospects do I have", "list my prospects", "find Bravo", "approve msg:" + MB, "reject msg:" + MB, "approve the email to bravo", "what's left to finish setup", "hi", "help", "add prospect Jane Doe jane@x.com", 'change my offer line to "x"', "contact support: help me please"];

test("every client intent is covered by the isolation run", () => {
  const hit = new Set(QUERIES.map((q) => route(q, "client")?.intent));
  for (const i of CLIENT_INTENTS) assert.ok(hit.has(i), `not exercised: ${i}`);
});

test("client A never sees business B's data, and never touches team tables", async () => {
  for (const q of QUERIES) {
    const log: Q[] = []; const r = route(q, "client")!; assert.ok(r, q);
    const reply = await runClient(deps(log), r, q, sign);
    const blob = JSON.stringify(reply);
    assert.ok(!/SECRET|b@bravo\.com|x@b\.com|Boise|999/.test(blob), `leak in "${q}": ${blob}`);
    for (const x of log) {
      assert.ok([...CLIENT_TABLES, "businesses"].includes(x.table as never), `"${q}" touched ${x.table}`);
      if (x.table === "businesses") { assert.ok(x.filters.some(([o, k, v]) => o === "eq" && k === "id" && v === A)); assert.ok(x.filters.some(([o, k, v]) => o === "eq" && k === "owner_id" && v === UA)); }
      else assert.ok(x.filters.some(([o, k, v]) => o === "eq" && k === "business_id" && v === A), `"${q}" query on ${x.table} not pinned to A`);
    }
  }
  const log: Q[] = []; const b = await briefingClient(deps(log)); assert.ok(!/SECRET/.test(JSON.stringify(b)));
  for (const x of log) assert.ok(x.filters.some(([o, k, v]) => k === "business_id" && v === A));
});

test("approving / rejecting B's draft by id is impossible for A (proposal + execute)", async () => {
  const log: Q[] = [];
  const p = await runClient(deps(log), route("approve msg:" + MB, "client")!, "", sign);
  assert.equal(p.confirm, undefined); // A can't even get a proposal for B's message
  const calls: string[] = [];
  const engine = { approveMessage: async () => { calls.push("approve"); }, rejectMessage: async () => { calls.push("reject"); }, addProspect: async () => { calls.push("add"); } };
  const ctx = deps([]).ctx; const svc = fakeDb([]) as never;
  const r1 = await executeClient(svc, ctx, { intent: "c_approve", args: { messageId: MB } }, engine);
  const r2 = await executeClient(svc, ctx, { intent: "c_reject", args: { messageId: MB, reason: "x" } }, engine);
  assert.match(r1.text, /isn't on your account/); assert.match(r2.text, /isn't on your account/);
  assert.deepEqual(calls, []);
  const ok = await executeClient(svc, ctx, { intent: "c_approve", args: { messageId: MA } }, engine);
  assert.deepEqual(calls, ["approve"]); assert.match(ok.text, /Approved/);
});

test("team intents are unreachable from the client role", () => {
  for (const q of ["move Acme to contacted", "assign Acme to Braylen", "show my pipeline", "agent tasks", "archive Acme", "how many FL leads are in New?"]) {
    const r = route(q, "client"); assert.ok(!r || r.intent.startsWith("c_") || r.intent === "help" || r.intent === "greeting", `${q} → ${r?.intent}`);
  }
});
