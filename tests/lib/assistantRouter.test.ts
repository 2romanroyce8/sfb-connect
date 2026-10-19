import { test } from "node:test";
import assert from "node:assert/strict";
import { route, parseWhen, TEAM_INTENTS, CLIENT_INTENTS } from "../../lib/assistant/router";

const NOW = new Date("2026-10-19T14:00:00Z"); // Mon Oct 19, 10:00 AM ET
const r = (q: string, role: "team" | "client" = "team") => route(q, role, NOW);

test("10 sample team queries route correctly", () => {
  assert.deepEqual(r("How many FL leads are in New?"), { intent: "lead_count", slots: { stage: "new", state: "FL", tag: undefined }, write: false });
  assert.equal(r("show my pipeline")!.intent, "pipeline_summary");
  const f = r("Add a follow-up for Acme Roofing tomorrow at 2pm")!;
  assert.equal(f.intent, "add_followup"); assert.equal(f.write, true); assert.equal(f.slots.lead, "Acme Roofing"); assert.equal(f.slots.dueAt, "2026-10-20T18:00:00.000Z");
  assert.deepEqual(r("move Acme Roofing to Contacted"), { intent: "move_stage", slots: { lead: "Acme Roofing", leadId: undefined, stage: "contacted" }, write: true });
  const t = r("schedule a follow-up with Ja-Mar Roofing tuesday")!; assert.equal(t.intent, "add_followup"); assert.equal(t.slots.lead, "Ja-Mar Roofing"); assert.equal(t.slots.dueAt, "2026-10-20T14:00:00.000Z");
  assert.equal(r("what are my overdue follow-ups")!.intent, "followups_overdue");
  assert.equal(r("who do I call today")!.intent, "followups_today");
  assert.equal(r("any stuck deals?")!.intent, "stuck_deals");
  assert.equal(r("brief me")!.intent, "briefing");
  assert.deepEqual(r("tag Sunshine Roofing with priority-dossier")!.slots, { lead: "Sunshine Roofing", tag: "priority-dossier", leadId: undefined });
  assert.equal(r("how many leads tagged roofing-pilot")!.slots.tag, "roofing-pilot");
  assert.equal(r("move Bob's Roofing to demo done")!.slots.stage, "meeting_completed");
  assert.deepEqual(r("note on Acme Roofing: owner wants a call after 3")!.slots, { lead: "Acme Roofing", leadId: undefined, text: "owner wants a call after 3" });
  assert.equal(r("assign Acme Roofing to Braylen")!.slots.rep, "Braylen");
  assert.equal(r("find Ja-Mar Roofing")!.slots.lead, "Ja-Mar Roofing");
  assert.equal(r("open the pipeline")!.intent, "navigate");
  assert.equal(r("what did we close this week")!.intent, "won_deals");
});

test("10 sample client queries route correctly", () => {
  assert.equal(r("how many credits do I have", "client")!.intent, "c_credits");
  assert.equal(r("what's left to finish setup?", "client")!.intent, "c_onboarding");
  assert.equal(r("any emails waiting for my approval", "client")!.intent, "c_approvals");
  assert.equal(r("did anyone reply?", "client")!.intent, "c_replies");
  assert.equal(r("show my meetings", "client")!.intent, "c_meetings");
  assert.equal(r("is gmail connected", "client")!.intent, "c_connections");
  assert.equal(r("how many prospects do I have", "client")!.intent, "c_prospect_count");
  const a = r("add prospect Jane Doe jane@acme.com", "client")!; assert.equal(a.intent, "c_add_prospect"); assert.equal(a.slots.email, "jane@acme.com"); assert.equal(a.slots.name, "Jane Doe");
  assert.deepEqual(r('change my offer line to "We answer every missed call."', "client")!.slots, { text: "We answer every missed call." });
  assert.equal(r("contact support: my calendar isn't syncing", "client")!.slots.text, "my calendar isn't syncing");
});

test("roles never cross: client can't reach team intents, team can't reach client intents", () => {
  for (const q of ["move Acme Roofing to Contacted", "show my pipeline", "assign Acme to Braylen", "agent tasks", "brief me"]) { const x = r(q, "client"); assert.ok(!x || x.intent.startsWith("c_") || ["help", "greeting"].includes(x.intent), q); }
  for (const q of ["how many credits do I have", "approve the email to Acme"]) { const x = r(q, "team"); assert.ok(!x || !x.intent.startsWith("c_"), q); }
});

test("coverage: 30+ team intents, 20+ client intents", () => {
  assert.ok(TEAM_INTENTS.length >= 30, `team ${TEAM_INTENTS.length}`);
  assert.ok(CLIENT_INTENTS.length >= 20, `client ${CLIENT_INTENTS.length}`);
});

test("dates: ET wall clock", () => {
  assert.equal(parseWhen("today at 6pm", NOW)!.dueAt, "2026-10-19T22:00:00.000Z");
  assert.equal(parseWhen("in 3 days", NOW)!.dueAt, "2026-10-22T14:00:00.000Z");
  assert.equal(parseWhen("next monday", NOW)!.dueAt, "2026-10-26T14:00:00.000Z");
  assert.equal(parseWhen("nov 3 at 9:30am", NOW)!.dueAt, "2026-11-03T14:30:00.000Z"); // after DST ends → EST
  assert.equal(parseWhen("nothing here", NOW), null);
});
