// Webhook acknowledgement policy tests.
//
// The rule being protected: a VALID event is only acknowledged once it is durably stored.
// Anything that would drop such an event must return a retryable status instead.
//
// Run: node --test tests/tiktok/ack.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { ackFor, ackRejected } from "../../src/lib/tiktokAck.ts";

test("item 10 — a durable-storage failure never reports success", () => {
  const decision = ackFor("storage_unavailable");
  assert.equal(decision.status, 503);
  assert.equal(decision.retry, true);
});

test("a newly queued event is acknowledged", () => {
  const decision = ackFor("queued");
  assert.equal(decision.status, 200);
  assert.equal(decision.retry, false);
});

test("item 5 — a duplicate delivery is acknowledged, not retried", () => {
  // The unique violation means the event is already recorded: retrying would only produce
  // the same outcome, and must not produce a second reply.
  const decision = ackFor("duplicate");
  assert.equal(decision.status, 200);
  assert.equal(decision.retry, false);
});

test("events we cannot act on are acknowledged rather than retried forever", () => {
  for (const outcome of ["unknown_account", "not_actionable", "ignored_event", "unparseable"]) {
    const decision = ackFor(outcome);
    assert.equal(decision.status, 200, `${outcome} should be acknowledged`);
    assert.equal(decision.retry, false);
  }
});

test("moderation actions are acknowledged with the action recorded in the note", () => {
  const decision = ackFor("ignored_action", "set_to_hidden");
  assert.equal(decision.status, 200);
  assert.equal(decision.note, "ignored_action:set_to_hidden");
});

test("items 7/8 — an unverifiable delivery is 401 and never a success", () => {
  const decision = ackRejected();
  assert.equal(decision.status, 401);
  assert.equal(decision.retry, false);
  assert.equal(decision.note, "invalid_signature");
});

test("only storage failure asks TikTok to retry", () => {
  const retryable = ["queued", "duplicate", "unknown_account", "not_actionable", "ignored_event",
    "ignored_action", "unparseable", "storage_unavailable"]
    .filter((o) => ackFor(o).retry);
  assert.deepEqual(retryable, ["storage_unavailable"]);
});
