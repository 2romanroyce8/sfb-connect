#!/usr/bin/env -S npx tsx
/**
 * Thin CLI for the prospect research feed — the same code the nightly cron runs.
 *
 *   npx tsx scripts/research-feed.ts                       # dry run, all active targets from DB
 *   npx tsx scripts/research-feed.ts --commit              # persist findings + file tasks
 *   npx tsx scripts/research-feed.ts --target roofing:Tampa:FL --sources exa
 *   npx tsx scripts/research-feed.ts --offline fixtures.json   # no network: feed a JSON array of RawFinding
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (always), EXA_API_KEY (for --sources exa).
 * Nothing is written unless --commit is given.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { runFeed } from "../lib/research/feed/run";
import { exaFeedSource } from "../lib/research/feed/sources/exa";
import { rssFeedSource } from "../lib/research/feed/sources/rss";
import type { FeedSource, FeedTarget, RawFinding, RssFeed } from "../lib/research/feed/types";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."); process.exit(2); }
  const service = createClient(url, key, { auth: { persistSession: false } });

  let targets: FeedTarget[] | undefined;
  const t = opt("target");
  if (t) {
    const [vertical, city, state] = t.split(":");
    if (!vertical || !city || !state) { console.error("--target vertical:City:ST"); process.exit(2); }
    const { data } = await service.from("research_feed_targets").select("id, vertical, city, state, queries, active").eq("vertical", vertical).eq("city", city).eq("state", state.toUpperCase()).maybeSingle();
    targets = [data ? (data as FeedTarget) : { id: "00000000-0000-0000-0000-000000000000", vertical, city, state: state.toUpperCase(), queries: null, active: true }];
  }

  let sources: FeedSource[] | undefined;
  const offline = opt("offline");
  if (offline) {
    const raws = JSON.parse(readFileSync(offline, "utf8")) as RawFinding[];
    sources = [{ kind: "exa", isConfigured: () => true, async pull(target) { return raws.filter((r) => !r.targetId || r.targetId === target.id).map((r) => ({ ...r, targetId: target.id })); } }];
  } else {
    const wanted = (opt("sources") ?? "exa,rss").split(",");
    sources = [];
    if (wanted.includes("exa")) sources.push(exaFeedSource());
    if (wanted.includes("rss")) {
      const { data } = await service.from("research_feed_sources").select("id, url, label, active").eq("kind", "rss").eq("active", true);
      sources.push(rssFeedSource((data ?? []) as RssFeed[]));
    }
  }

  const summary = await runFeed({ service, trigger: "cli", sources, targets, dryRun: !flag("commit"), limitPerTarget: Number(opt("limit") ?? 10), deadlineMs: Number(opt("deadline") ?? 120_000) });
  console.log(JSON.stringify(summary, null, 2));
  if (!flag("commit")) console.error("\nDry run — nothing persisted, no tasks filed. Add --commit to write.");
}
main().catch((e) => { console.error(e); process.exit(1); });
