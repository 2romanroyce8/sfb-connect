import { test } from "node:test";
import assert from "node:assert/strict";
import { assistEditRaw, ASSIST_MODEL, checkAssistResult } from "../../lib/outbound/assist";
import { estimateCostCents, dayStart, capDecision, MODEL_PRICE_USD_PER_MTOK } from "../../lib/outbound/assistSpend";

const draft = { subject: "Quick note from {{sender_name}}", body: "Hi {{first_name}},\n\nI run {{sender_company}} and wanted to say hello.\n\n{{sender_name}}" };

test("cost: list price applied per token, 4dp cents; unknown model is never priced as free", () => {
  const p = MODEL_PRICE_USD_PER_MTOK[ASSIST_MODEL];
  assert.equal(estimateCostCents({ model: ASSIST_MODEL, input_tokens: 1_000_000, output_tokens: 0 }), p.input * 100);
  assert.equal(estimateCostCents({ model: ASSIST_MODEL, input_tokens: 0, output_tokens: 1_000_000 }), p.output * 100);
  assert.equal(estimateCostCents({ model: ASSIST_MODEL, input_tokens: 400, output_tokens: 250 }), Math.round(((400 / 1e6) * p.input + (250 / 1e6) * p.output) * 100 * 10000) / 10000);
  assert.ok(estimateCostCents({ model: "some-future-model", input_tokens: 1000, output_tokens: 1000 }) > 0);
  assert.equal(estimateCostCents({ model: ASSIST_MODEL, input_tokens: 0, output_tokens: 0 }), 0);
});

test("day window: starts at midnight America/New_York, not UTC", () => {
  // 2026-10-13T02:30Z is 2026-10-12 22:30 EDT → day started 2026-10-12T04:00Z
  assert.equal(dayStart(new Date("2026-10-13T02:30:00Z")), "2026-10-12T04:00:00.000Z");
  // 2026-10-13T05:00Z is 2026-10-13 01:00 EDT → new day, started 2026-10-13T04:00Z
  assert.equal(dayStart(new Date("2026-10-13T05:00:00Z")), "2026-10-13T04:00:00.000Z");
  // Winter (EST): 2026-12-01T03:00Z is 2026-11-30 22:00 EST → 2026-11-30T05:00Z
  assert.equal(dayStart(new Date("2026-12-01T03:00:00Z")), "2026-11-30T05:00:00.000Z");
});

test("cap decision: under cap → open; at or over → capped; cap 0 → always capped", () => {
  assert.deepEqual(capDecision(500, 120.5), { capped: false, remainingCents: 379.5 });
  assert.deepEqual(capDecision(500, 500), { capped: true, remainingCents: 0 });
  assert.deepEqual(capDecision(500, 612), { capped: true, remainingCents: 0 });
  assert.deepEqual(capDecision(0, 0), { capped: true, remainingCents: 0 });
});

test("assistEditRaw: no key → ok:false with zero usage and no network call", async () => {
  const prev = process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_API_KEY;
  let called = 0;
  const r = await assistEditRaw(draft, "shorter", (async () => { called++; return new Response("{}"); }) as typeof fetch);
  process.env.ANTHROPIC_API_KEY = prev;
  assert.equal(r.ok, false); assert.equal(called, 0); assert.deepEqual(r.usage, { model: ASSIST_MODEL, input_tokens: 0, output_tokens: 0 });
});

test("assistEditRaw with a key: returns the rewritten draft AND the usage the provider billed; a guard refusal still carries usage", async () => {
  const prev = process.env.ANTHROPIC_API_KEY; process.env.ANTHROPIC_API_KEY = "test-key-not-real";
  const fake = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch;
  const good = await assistEditRaw(draft, "shorter", fake({ model: ASSIST_MODEL, usage: { input_tokens: 212, output_tokens: 61 }, content: [{ type: "text", text: JSON.stringify({ subject: "Note from {{sender_name}}", body: "Hi {{first_name}}, I run {{sender_company}}. Hello.\n{{sender_name}}" }) }] }));
  assert.equal(good.ok, true); if (good.ok) { assert.equal(good.edited.subject, "Note from {{sender_name}}"); assert.deepEqual(good.usage, { model: ASSIST_MODEL, input_tokens: 212, output_tokens: 61 }); }
  const dropped = await assistEditRaw(draft, "shorter", fake({ usage: { input_tokens: 200, output_tokens: 40 }, content: [{ text: JSON.stringify({ subject: "Note", body: "Hi {{first_name}}, hello." }) }] }));
  assert.equal(dropped.ok, false); if (!dropped.ok) { assert.match(dropped.error, /dropped \{\{sender_name\}\}/); assert.equal(dropped.usage.input_tokens, 200); }
  const apiErr = await assistEditRaw(draft, "fix", (async () => new Response(JSON.stringify({ error: { message: "rate limited" } }), { status: 429 })) as typeof fetch);
  assert.equal(apiErr.ok, false); if (!apiErr.ok) assert.equal(apiErr.error, "rate limited");
  process.env.ANTHROPIC_API_KEY = prev;
});

test("guard still refuses edits that invent placeholders", () => {
  assert.match(checkAssistResult(draft, { subject: "x {{sender_name}}", body: "{{first_name}} {{sender_company}} {{sender_name}} {{city}}" }) ?? "", /added \{\{city\}\}/);
});
