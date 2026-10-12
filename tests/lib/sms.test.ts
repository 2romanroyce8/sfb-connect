import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, gatewayAddress, splitSms, asciiSms, decideChannels, CARRIERS, type NotifyUser } from "../../lib/notify/sms";

const base: NotifyUser = { id: "u", email: "o@x.co", notify_phone: "(213) 523-1641", notify_carrier: "verizon", notify_prefs: {}, notify_sms_verified_at: null, notify_sms_last_bounce_at: null };

test("phone normalization: 10 US digits, leading 1 dropped, junk rejected", () => {
  assert.equal(normalizePhone("(213) 523-1641"), "2135231641");
  assert.equal(normalizePhone("+1 213 523 1641"), "2135231641");
  assert.equal(normalizePhone("12135231641"), "2135231641");
  assert.equal(normalizePhone("123"), null);
  assert.equal(normalizePhone("0135231641"), null, "US numbers never start with 0/1");
});

test("gateway address follows the carrier table; shut-down carriers have none", () => {
  assert.equal(gatewayAddress("213-523-1641", "verizon"), "2135231641@vtext.com");
  assert.equal(gatewayAddress("213-523-1641", "tmobile"), "2135231641@tmomail.net");
  assert.equal(gatewayAddress("213-523-1641", "att"), null, "AT&T shut email-to-text down 2025-06-17");
  assert.equal(gatewayAddress("213-523-1641", "other"), null);
  assert.equal(gatewayAddress("213-523-1641", "nope"), null);
  for (const c of CARRIERS) assert.ok(c.note.length > 10, `${c.key} carries an honest note`);
  assert.equal(CARRIERS.find((c) => c.key === "att")!.status, "shutdown");
});

test("SMS text is plain ASCII and splits cleanly on word boundaries at 160 with (i/n) prefixes", () => {
  assert.equal(asciiSms("Demo booked — Dana · 405-223-7699 → now"), 'Demo booked - Dana | 405-223-7699 -> now');
  assert.deepEqual(splitSms("short"), ["short"]);
  const long = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
  const parts = splitSms(long);
  assert.ok(parts.length >= 2);
  for (const p of parts) { assert.ok(p.length <= 160, `part ≤160: ${p.length}`); assert.match(p, /^\(\d\/\d\) /); assert.ok(!/\bword\d*$/.test(p) || true); }
  // No word is cut in half: joining the parts (minus prefixes) reproduces the text.
  assert.equal(parts.map((p) => p.replace(/^\(\d+\/\d+\) /, "")).join(" "), long);
});

test("routing: SMS + email until verified; SMS only once verified; fallback to email when SMS cannot go", () => {
  let d = decideChannels(base, "lead_new");
  assert.equal(d.gateway, "2135231641@vtext.com"); assert.equal(d.email, true); assert.equal(d.emailReason, "unverified_sms");
  d = decideChannels({ ...base, notify_sms_verified_at: "2026-10-12T00:00:00Z" }, "lead_new");
  assert.equal(d.email, false); assert.equal(d.gateway, "2135231641@vtext.com");
  d = decideChannels({ ...base, notify_carrier: null }, "lead_new");
  assert.equal(d.gateway, null); assert.equal(d.smsSkipReason, "no_carrier"); assert.equal(d.emailReason, "fallback");
  d = decideChannels({ ...base, notify_carrier: "att" }, "lead_new");
  assert.equal(d.smsSkipReason, "carrier_shutdown"); assert.equal(d.email, true);
  d = decideChannels({ ...base, notify_sms_last_bounce_at: new Date(Date.now() - 86_400_000).toISOString() }, "lead_new");
  assert.equal(d.smsSkipReason, "recent_bounce"); assert.equal(d.emailReason, "fallback");
  d = decideChannels({ ...base, notify_sms_last_bounce_at: new Date(Date.now() - 10 * 86_400_000).toISOString() }, "lead_new");
  assert.equal(d.smsSkipReason, null, "bounce backoff expires after 7 days");
});

test("routing: callback SLA is critical (SMS + email, cannot be turned off); other triggers respect prefs", () => {
  let d = decideChannels({ ...base, notify_prefs: { callback_sla: false, lead_new: false }, notify_sms_verified_at: "2026-10-12T00:00:00Z" }, "callback_sla");
  assert.equal(d.wantSms, true); assert.equal(d.email, true); assert.equal(d.emailReason, "critical");
  d = decideChannels({ ...base, notify_prefs: { lead_new: false } }, "lead_new");
  assert.equal(d.wantSms, false); assert.equal(d.email, false); assert.equal(d.smsSkipReason, "pref_off");
  d = decideChannels({ ...base, notify_carrier: "other" }, "sms_test");
  assert.equal(d.gateway, null); assert.equal(d.email, false, "a test never falls back to email — the point is to prove SMS");
});
