// ============================================================
// Regression suite for the timezone-aware scheduling service
// (lib/crm/timezone.ts + lib/crm/usStateTimezones.ts).
//
// Covers the required tests from the timezone-aware-scheduling spec:
// Roman/Logan (Eastern), Braylen (Central), a California (Pacific)
// business, reverse entry (rep enters MY time), DST-transition dates on
// both sides, and a multi-timezone state where city-level precision
// changes the answer.
//
// Run with: npx tsx --test tests/lib/timezone-scheduling.test.ts
// ============================================================
import test from "node:test";
import assert from "node:assert/strict";
import { zonedTimeToUtcISO, formatInTimeZone, resolveBusinessTimezone, formatDualTimezone, validateLocalDatetime } from "../../lib/crm/timezone";
import { findStateTimezone } from "../../lib/crm/usStateTimezones";

const CA_BUSINESS_DATE = "2026-09-24"; // well clear of any DST transition
const CA_BUSINESS_TIME = "16:00"; // "4:00 PM Pacific" as the customer said it

// ---- Test 41 — Roman (America/New_York) ----
test("Roman — California client's 4:00 PM Pacific becomes 7:00 PM Eastern", () => {
  const utc = zonedTimeToUtcISO(CA_BUSINESS_DATE, CA_BUSINESS_TIME, "America/Los_Angeles");
  assert.equal(utc, "2026-09-24T23:00:00.000Z", "verify the exact UTC instant, not just the displayed local time");
  const romanTime = formatInTimeZone(utc, "America/New_York", { hour: "numeric", minute: "2-digit" });
  assert.equal(romanTime, "7:00 PM");
});

// ---- Test 42 — Logan (America/New_York) ----
test("Logan — same California business, same 7:00 PM Eastern", () => {
  const utc = zonedTimeToUtcISO(CA_BUSINESS_DATE, CA_BUSINESS_TIME, "America/Los_Angeles");
  assert.equal(formatInTimeZone(utc, "America/New_York", { hour: "numeric", minute: "2-digit" }), "7:00 PM");
});

// ---- Test 43 — Braylen (America/Chicago) ----
test("Braylen — same California client, 6:00 PM Central (not 7:00 PM)", () => {
  const utc = zonedTimeToUtcISO(CA_BUSINESS_DATE, CA_BUSINESS_TIME, "America/Los_Angeles");
  assert.equal(formatInTimeZone(utc, "America/Chicago", { hour: "numeric", minute: "2-digit" }), "6:00 PM");
});

// ---- Test 44 — Reverse entry ----
test("Reverse entry — Roman enters 4:00 PM HIS time, California customer sees 1:00 PM Pacific", () => {
  const utc = zonedTimeToUtcISO(CA_BUSINESS_DATE, "16:00", "America/New_York");
  assert.equal(formatInTimeZone(utc, "America/New_York", { hour: "numeric", minute: "2-digit" }), "4:00 PM");
  assert.equal(formatInTimeZone(utc, "America/Los_Angeles", { hour: "numeric", minute: "2-digit" }), "1:00 PM");
});

// ---- Test 46 — different viewers, same instant ----
test("Different viewers see different local times for the SAME underlying UTC instant", () => {
  const utc = zonedTimeToUtcISO(CA_BUSINESS_DATE, CA_BUSINESS_TIME, "America/Los_Angeles");
  const roman = formatInTimeZone(utc, "America/New_York", { hour: "numeric", minute: "2-digit" });
  const braylen = formatInTimeZone(utc, "America/Chicago", { hour: "numeric", minute: "2-digit" });
  assert.notEqual(roman, braylen);
  // But both derive from the identical stored instant:
  assert.equal(utc, zonedTimeToUtcISO(CA_BUSINESS_DATE, CA_BUSINESS_TIME, "America/Los_Angeles"));
});

// ---- Test 49 — DST transitions, no fixed-offset assumptions ----
test("DST — Eastern offset changes across the November 'fall back' transition", () => {
  // The US DST-end transition happens at 2am local time on the 1st Sunday
  // of November (Nov 1, 2026) -- by noon that same day, standard time
  // (EST) is already in effect. Oct 31 (the day before) is still EDT.
  const beforeFallBack = zonedTimeToUtcISO("2026-10-31", "12:00", "America/New_York");
  const afterFallBack = zonedTimeToUtcISO("2026-11-02", "12:00", "America/New_York");
  assert.equal(beforeFallBack, "2026-10-31T16:00:00.000Z", "noon EDT (UTC-4) on Oct 31, before the transition");
  assert.equal(afterFallBack, "2026-11-02T17:00:00.000Z", "noon EST (UTC-5) on Nov 2 -- one hour LATER in UTC for the same wall-clock noon");
});

test("DST — Pacific offset changes across the March 'spring forward' transition", () => {
  // 2027-03-14 is the 2nd Sunday of March 2027 (DST begins).
  const beforeSpringForward = zonedTimeToUtcISO("2027-03-13", "12:00", "America/Los_Angeles");
  const afterSpringForward = zonedTimeToUtcISO("2027-03-15", "12:00", "America/Los_Angeles");
  assert.equal(beforeSpringForward, "2027-03-13T20:00:00.000Z", "noon PST (UTC-8) before the transition");
  assert.equal(afterSpringForward, "2027-03-15T19:00:00.000Z", "noon PDT (UTC-7) after the transition -- one hour EARLIER in UTC");
});

test("DST — a fixed '3 hour' assumption between Eastern and Pacific would be wrong on transition-week edge cases; Arizona never observes DST at all", () => {
  // Arizona (America/Phoenix) doesn't observe DST, so its gap to Los
  // Angeles changes between winter (both UTC-8/-7, so 0-1hr apart when LA
  // is on standard time) and summer (LA is UTC-7 PDT, Phoenix stays
  // UTC-7 -- SAME offset in summer, unlike the "always 1 hour" myth).
  const winterUtc = zonedTimeToUtcISO("2026-01-15", "12:00", "America/Phoenix");
  const summerUtc = zonedTimeToUtcISO("2026-07-15", "12:00", "America/Phoenix");
  const winterLA = formatInTimeZone(winterUtc, "America/Los_Angeles", { hour: "numeric", minute: "2-digit" });
  const summerLA = formatInTimeZone(summerUtc, "America/Los_Angeles", { hour: "numeric", minute: "2-digit" });
  assert.equal(winterLA, "11:00 AM", "in winter, Phoenix (UTC-7, no DST) is 1hr ahead of LA (UTC-8 PST)");
  assert.equal(summerLA, "12:00 PM", "in summer, Phoenix (UTC-7) and LA (UTC-7 PDT) are the SAME offset");
});

// ---- Test 50 — multi-timezone state handling ----
test("Multi-timezone state — Texas state-only resolution is low-confidence", () => {
  const r = resolveBusinessTimezone({ state: "Texas" });
  assert.equal(r.timezone, "America/Chicago");
  assert.equal(r.confidence, "low", "Texas spans Central and Mountain -- state alone must not be trusted as high-confidence");
  assert.equal(r.source, "state_inference");
});

test("Multi-timezone state — a known city in the minority zone overrides the state default", () => {
  const r = resolveBusinessTimezone({ city: "El Paso", state: "Texas" });
  assert.equal(r.timezone, "America/Denver", "El Paso is Mountain time despite being in Texas");
  assert.equal(r.confidence, "high");
  assert.equal(r.source, "city_state");
});

test("Multi-timezone state — a known city in the MAJORITY zone still resolves correctly", () => {
  const r = resolveBusinessTimezone({ city: "Amarillo", state: "Texas" });
  assert.equal(r.timezone, "America/Chicago");
  assert.equal(r.confidence, "high");
});

test("Unambiguous state resolves with high confidence from state alone", () => {
  const r = resolveBusinessTimezone({ state: "California" });
  assert.equal(r.timezone, "America/Los_Angeles");
  assert.equal(r.confidence, "high");
});

test("Unrecognized state never fabricates a timezone", () => {
  const r = resolveBusinessTimezone({ state: "Not A Real State" });
  assert.equal(r.timezone, null);
  assert.equal(r.source, null);
});

test("findStateTimezone accepts both full name and abbreviation, case-insensitive", () => {
  assert.equal(findStateTimezone("california")?.timezone, "America/Los_Angeles");
  assert.equal(findStateTimezone("CA")?.timezone, "America/Los_Angeles");
  assert.equal(findStateTimezone("ca")?.timezone, "America/Los_Angeles");
});

// ---- Dual-time preview ----
test("formatDualTimezone renders both sides of the same instant with zone labels", () => {
  const utc = zonedTimeToUtcISO(CA_BUSINESS_DATE, CA_BUSINESS_TIME, "America/Los_Angeles");
  const dual = formatDualTimezone(utc, "America/Los_Angeles", "America/New_York");
  assert.equal(dual.businessTime, "4:00 PM");
  assert.equal(dual.employeeTime, "7:00 PM");
  assert.match(dual.businessTzLabel, /PDT|PT/);
  assert.match(dual.employeeTzLabel, /EDT|ET/);
});

// ---- Input validation ----
test("validateLocalDatetime rejects malformed input", () => {
  assert.equal(validateLocalDatetime("2026-09-24", "16:00"), true);
  assert.equal(validateLocalDatetime("09/24/2026", "16:00"), false);
  assert.equal(validateLocalDatetime("2026-09-24", "4:00 PM"), false);
  assert.equal(validateLocalDatetime("2026-13-45", "16:00"), false);
});
