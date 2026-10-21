import { test } from "node:test";
import assert from "node:assert/strict";
import { startSequenceBlocker } from "../../lib/outbound/sequenceRules";

test("bulk start-sequence eligibility: needs an email; not already in a sequence; not unsubscribed", () => {
  assert.equal(startSequenceBlocker({ email: "a@b.co", status: "new" }), null);
  assert.equal(startSequenceBlocker({ email: "a@b.co", status: "enriched" }), null);
  assert.equal(startSequenceBlocker({ email: null, status: "new" }), "no email yet");
  assert.equal(startSequenceBlocker({ email: "", status: "new" }), "no email yet");
  assert.equal(startSequenceBlocker({ email: "a@b.co", status: "in_sequence" }), "already in a sequence");
  assert.equal(startSequenceBlocker({ email: "a@b.co", status: "unsubscribed" }), "unsubscribed");
});
