// Regression tests for TikTok large-integer id handling.
//
// These import the TypeScript source DIRECTLY (Node strips types); the module under test has
// no imports of its own precisely so this is possible. Every test is written so that it FAILS
// if an id is ever converted to a JavaScript Number first.
//
// Run: node --test tests/tiktok/lossless.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseJsonLossless, quoteIdFields, idToString, losslessJsonSupported, TIKTOK_ID_FIELDS,
} from "../../src/lib/losslessJson.ts";

// The exact id from the official documentation example, and a second 19-digit id.
const COMMENT_ID = "6990565363377392901";
const VIDEO_ID = "7391000000000000001";
const PARENT_ID = "6990565363377392999";

/** Proves the premise: these ids genuinely break under a plain JSON.parse. */
test("the naive approach really is lossy (guards the premise of this suite)", () => {
  const naive = JSON.parse(`{"comment_id":${COMMENT_ID}}`);
  assert.notEqual(String(naive.comment_id), COMMENT_ID);
  assert.ok(!Number.isSafeInteger(naive.comment_id));
});

// Both code paths must behave identically: the native reviver-source path and the
// text-quoting fallback for runtimes without it.
const MODES = [
  { name: "native source access", forceFallback: false },
  { name: "text-quoting fallback", forceFallback: true },
];

for (const mode of MODES) {
  test(`[${mode.name}] item 1 — 19-digit comment_id survives exactly`, () => {
    const parsed = parseJsonLossless(
      `{"comment_id":${COMMENT_ID},"text":"hello"}`,
      TIKTOK_ID_FIELDS,
      { forceFallback: mode.forceFallback },
    );
    assert.equal(parsed.comment_id, COMMENT_ID);
    assert.equal(typeof parsed.comment_id, "string");
  });

  test(`[${mode.name}] item 2 — 19-digit video_id survives exactly`, () => {
    const parsed = parseJsonLossless(
      `{"video_id":${VIDEO_ID}}`,
      TIKTOK_ID_FIELDS,
      { forceFallback: mode.forceFallback },
    );
    assert.equal(parsed.video_id, VIDEO_ID);
  });

  test(`[${mode.name}] item 3 — parent_comment_id survives exactly`, () => {
    const parsed = parseJsonLossless(
      `{"comment_id":${COMMENT_ID},"parent_comment_id":${PARENT_ID},"comment_type":"reply"}`,
      TIKTOK_ID_FIELDS,
      { forceFallback: mode.forceFallback },
    );
    assert.equal(parsed.parent_comment_id, PARENT_ID);
    assert.equal(parsed.comment_id, COMMENT_ID);
  });

  test(`[${mode.name}] a full comment.update content block survives`, () => {
    const content = `{"comment_id":${COMMENT_ID},"video_id":${VIDEO_ID},"parent_comment_id":${PARENT_ID},` +
      `"comment_type":"reply","comment_action":"insert","timestamp":1758000000,` +
      `"unique_identifier":"+ABc1D2/E0fGhijkl","text":"كم السعر؟"}`;
    const parsed = parseJsonLossless(content, TIKTOK_ID_FIELDS, { forceFallback: mode.forceFallback });
    assert.equal(parsed.comment_id, COMMENT_ID);
    assert.equal(parsed.video_id, VIDEO_ID);
    assert.equal(parsed.parent_comment_id, PARENT_ID);
    // non-id fields keep their natural types
    assert.equal(parsed.timestamp, 1758000000);
    assert.equal(parsed.text, "كم السعر؟");
    assert.equal(parsed.comment_action, "insert");
  });

  test(`[${mode.name}] ids already sent as strings are passed through unchanged`, () => {
    const parsed = parseJsonLossless(
      `{"comment_id":"${COMMENT_ID}"}`,
      TIKTOK_ID_FIELDS,
      { forceFallback: mode.forceFallback },
    );
    assert.equal(parsed.comment_id, COMMENT_ID);
  });

  test(`[${mode.name}] item 4 — malformed JSON throws rather than returning junk`, () => {
    assert.throws(
      () => parseJsonLossless("{not json", TIKTOK_ID_FIELDS, { forceFallback: mode.forceFallback }),
      SyntaxError,
    );
  });

  test(`[${mode.name}] an id mentioned inside comment text is not rewritten`, () => {
    // A hostile/odd comment body containing what looks like a field assignment.
    const raw = JSON.stringify({ comment_id: 1, text: '{"comment_id":6990565363377392901}' });
    const parsed = parseJsonLossless(raw, TIKTOK_ID_FIELDS, { forceFallback: mode.forceFallback });
    assert.equal(parsed.text, '{"comment_id":6990565363377392901}');
  });

  test(`[${mode.name}] non-id numbers are left as numbers`, () => {
    const parsed = parseJsonLossless(
      `{"comment_id":${COMMENT_ID},"likes":42,"replies":7}`,
      TIKTOK_ID_FIELDS,
      { forceFallback: mode.forceFallback },
    );
    assert.equal(parsed.likes, 42);
    assert.equal(typeof parsed.likes, "number");
  });
}

test("the runtime actually supports native source access (informational)", () => {
  // Not an assertion about correctness — the fallback covers older runtimes — but it records
  // which path production will take on this Node version.
  assert.equal(typeof losslessJsonSupported(), "boolean");
});

test("quoteIdFields only touches the allow-listed fields", () => {
  const out = quoteIdFields(`{"comment_id":${COMMENT_ID},"other_id":${COMMENT_ID}}`);
  assert.ok(out.includes(`"comment_id":"${COMMENT_ID}"`));
  assert.ok(out.includes(`"other_id":${COMMENT_ID}`), "a non-allow-listed field was rewritten");
});

test("idToString refuses an id that already lost precision", () => {
  // 6990565363377392901 parsed as a Number is no longer a safe integer: reporting it as a
  // string would silently hand a WRONG id to the reply call and to deduplication.
  const lossy = JSON.parse(`{"comment_id":${COMMENT_ID}}`).comment_id;
  assert.throws(() => idToString(lossy), /unsafe_integer_id/);
});

test("idToString passes strings through and handles small numbers", () => {
  assert.equal(idToString(COMMENT_ID), COMMENT_ID);
  assert.equal(idToString(42), "42");
  assert.equal(idToString(null), null);
  assert.equal(idToString(undefined), null);
  assert.equal(idToString(""), null);
});
