import { test } from "node:test";
import assert from "node:assert/strict";
import { ANSWER_BANK, NO_MATCH_ANSWER, answerQuestion } from "../../lib/faqAnswers";

test("every answer-bank entry has a unique key and at least three keywords", () => {
  const keys = ANSWER_BANK.map((a) => a.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const a of ANSWER_BANK) assert.ok(a.keywords.length >= 3, a.key);
});

test("common questions route to the intended answer", () => {
  const cases: [string, string][] = [
    ["How much does it cost per month?", "price"],
    ["Is there a free trial? Do I need a credit card?", "trial"],
    ["What happens when I run out of credits", "zero"],
    ["Do unused credits roll over?", "rollover"],
    ["Can I get a refund", "refund"],
    ["Does it connect to GoHighLevel and Zapier?", "integrations"],
    ["Will this get me more leads? Guaranteed?", "results"],
    ["Can you white label this for my clients?", "agency_plan"],
    ["Does it work for a roofing company", "who_for"],
    ["How do I log in to my dashboard", "login"],
  ];
  for (const [q, key] of cases) assert.equal(answerQuestion(q).matched?.key, key, q);
});

test("unmatched or empty questions never get an invented answer", () => {
  for (const q of ["", "   ", "what is the meaning of life", "zxqv"]) {
    const r = answerQuestion(q);
    assert.equal(r.matched, null, q);
    assert.equal(r.answer, NO_MATCH_ANSWER);
  }
});

test("numbers in the bank come from the pricing single source", () => {
  const price = ANSWER_BANK.find((a) => a.key === "price")!.answer;
  assert.match(price, /Solo is \$1,497\/month plus a one-time \$1,497 onboarding fee, with 150 credits/);
  assert.match(price, /Agency is \$4,997\/month/);
  assert.match(ANSWER_BANK.find((a) => a.key === "zero")!.answer, /100 for \$149, 500 for \$599, 1,000 for \$999/);
  assert.match(ANSWER_BANK.find((a) => a.key === "outbound")!.answer, /roughly 10 fully worked prospects/);
});
