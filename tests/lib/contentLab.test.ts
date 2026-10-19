import { test } from "node:test";
import assert from "node:assert/strict";
import { extractHook, classifyHook, detectCta, extractHashtags, formatOf, velocity, analyzePost, whyWorking, etHour, type RawPost } from "../../lib/contentLab/analyze";
import { analyzePatterns, MIN_N } from "../../lib/contentLab/patterns";

const NOW = Date.parse("2026-10-19T12:00:00Z");
const P = (id: string, caption: string, likes: number, comments: number, hoursAgo: number, media = "REELS"): RawPost => ({ ig_media_id: id, username: "creator", caption, media_type: media, permalink: `https://instagram.com/p/${id}`, posted_at: new Date(NOW - hoursAgo * 3600e3).toISOString(), like_count: likes, comments_count: comments });

test("hook = first meaningful line", () => {
  assert.equal(extractHook("🔥🔥\n#ai #tools\nStop using ChatGPT like this\nmore text"), "Stop using ChatGPT like this");
  assert.equal(extractHook(null), "");
});

test("hook types", () => {
  assert.equal(classifyHook("Stop using ChatGPT like this"), "contrarian");
  assert.equal(classifyHook("5 AI tools that feel illegal to know"), "number_list");
  assert.equal(classifyHook("I built a SaaS in 48 hours with Cursor"), "build_story");
  assert.equal(classifyHook("Why is nobody talking about this?"), "curiosity_gap");
  assert.equal(classifyHook("What would you build with this?"), "question");
  assert.equal(classifyHook("How to vibe code your first app"), "how_to");
  assert.equal(classifyHook("POV: you shipped on a Sunday"), "pov");
  assert.equal(classifyHook("This app made $12k last month"), "result_claim");
  assert.equal(classifyHook("Claude is good"), "statement");
});

test("CTA detection incl. comment keyword", () => {
  assert.deepEqual(detectCta("Comment 'PROMPT' and I'll send you the list"), { kind: "comment_keyword", keyword: "PROMPT" });
  assert.deepEqual(detectCta("comment “AI” for the link"), { kind: "comment_keyword", keyword: "AI" });
  assert.deepEqual(detectCta("Comment below what you think"), { kind: "none", keyword: null });
  assert.equal(detectCta("Save this for later").kind, "save");
  assert.equal(detectCta("Link in bio").kind, "link_in_bio");
  assert.equal(detectCta("Follow for more AI tools").kind, "follow");
});

test("hashtags, format, velocity, ET hour", () => {
  assert.deepEqual(extractHashtags("x #AI #vibecoding #ai"), ["ai", "vibecoding"]);
  assert.equal(formatOf("CAROUSEL_ALBUM"), "carousel"); assert.equal(formatOf("VIDEO"), "reel"); assert.equal(formatOf(null), "unknown");
  assert.equal(velocity(P("a", "", 900, 100, 10), NOW), 100);
  assert.equal(velocity(P("b", "", 50, 0, 0.1), NOW), 50); // 1-hour floor
  assert.equal(etHour("2026-10-19T22:30:00Z"), 18);
});

test("velocity ranks over raw totals; why-it-works only states facts", () => {
  const posts = [P("old", "5 AI tools", 20000, 300, 720), P("fresh", "Stop doing this\nComment 'BUILD' and I'll send it", 3000, 900, 6), P("c", "hello", 100, 2, 10), P("d", "hi", 80, 1, 10)].map((p) => analyzePost(p, NOW));
  const ranked = [...posts].sort((a, b) => (b.velocity ?? 0) - (a.velocity ?? 0));
  assert.equal(ranked[0].ig_media_id, "fresh");
  const why = whyWorking(ranked[0], posts);
  assert.ok(why.some((r) => r.includes("median velocity")));
  assert.ok(why.some((r) => r.includes('"BUILD"')));
  assert.ok(why.some((r) => r.includes("Contrarian")));
});

test("patterns: small groups never win; testable variables listed", () => {
  const posts = [
    ...[1, 2, 3].map((i) => P(`q${i}`, "Why does nobody use this?", 500, 50, 5)),
    ...[1, 2, 3].map((i) => P(`s${i}`, "Claude is good", 50, 2, 5)),
    P("x", "5 tools", 99999, 9999, 1),
  ].map((p) => analyzePost(p, NOW));
  const r = analyzePatterns(posts);
  assert.equal(r.byHook[0].enough, true);
  assert.notEqual(r.byHook[0].key, "number_list"); // n=1 can't top the list
  assert.equal(r.byHook.find((g) => g.key === "number_list")!.enough, false);
  assert.deepEqual(r.testable.map((t) => t.key), ["hook_text", "cta_keyword", "hashtags", "thumbnail_frame", "post_time"]);
  assert.equal(MIN_N, 3);
});

import { allowedHashtags, HASHTAG_WEEKLY_CAP } from "../../lib/contentLab/instagram";
test("hashtag budget: 30 unique per rolling 7 days; repeats are free; expired ones free up", () => {
  const now = Date.parse("2026-10-19T12:00:00Z");
  const used: Record<string, { first_used_at: string }> = {};
  for (let i = 0; i < 29; i++) used[`t${i}`] = { first_used_at: "2026-10-18T00:00:00Z" };
  used.old = { first_used_at: "2026-10-01T00:00:00Z" };
  const r = allowedHashtags(["#t1", "new1", "new2", "old"], used, now);
  assert.deepEqual(r.allowed, ["t1", "new1"]);
  assert.deepEqual(r.blocked, ["new2", "old"]);
  assert.equal(HASHTAG_WEEKLY_CAP, 30);
});
