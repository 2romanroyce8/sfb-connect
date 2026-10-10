import type { SupabaseClient } from "@supabase/supabase-js";
import type { Candidate, FeedSource, FeedTarget, QualityFlag, RssFeed, RunSummary } from "./types";
import { HARD_DROP, isAccepted, toCandidates } from "./quality";
import { dedupeBatch, flagKnown, loadKnownKeys } from "./dedupe";
import { exaFeedSource } from "./sources/exa";
import { rssFeedSource } from "./sources/rss";
import { createTask } from "@/lib/agent/tasks/queue";
import { emitIntegrationEvent } from "@/lib/integrations/events";

/**
 * One feed run. Bounded by a wall-clock deadline (serverless-safe): targets
 * are processed oldest-run-first until the deadline, and whatever is left is
 * reported as skipped and picked up next run. Every accepted finding is
 * persisted, then grouped into ONE task per target for Atlas to qualify
 * (HyperAgent reviews). Dropped candidates are persisted too, with their
 * flags, so the filters can be audited and tuned.
 */
export type RunOptions = {
  service: SupabaseClient;
  trigger: RunSummary["trigger"];
  sources?: FeedSource[];          // default: exa + rss(active feeds from DB)
  targets?: FeedTarget[];          // default: active targets from DB
  limitPerTarget?: number;         // raw findings pulled per source per target
  deadlineMs?: number;             // total budget (default 45s)
  dryRun?: boolean;                // compute everything, persist nothing, file no tasks
  fileTasks?: boolean;             // default true
  now?: () => number;
};

const emptyDropped = (): Record<QualityFlag, number> => Object.fromEntries(HARD_DROP.map((f) => [f, 0])) as Record<QualityFlag, number>;

export async function loadTargets(service: SupabaseClient): Promise<FeedTarget[]> {
  const { data } = await service.from("research_feed_targets").select("id, vertical, city, state, queries, active, last_run_at").eq("active", true).order("last_run_at", { ascending: true, nullsFirst: true });
  return ((data ?? []) as (FeedTarget & { last_run_at: string | null })[]).map(({ last_run_at: _l, ...t }) => t);
}
export async function loadRssFeeds(service: SupabaseClient): Promise<RssFeed[]> {
  const { data } = await service.from("research_feed_sources").select("id, url, label, active").eq("kind", "rss").eq("active", true);
  return (data ?? []) as RssFeed[];
}

export async function runFeed(o: RunOptions): Promise<RunSummary> {
  const now = o.now ?? Date.now;
  const startedAt = new Date(now()).toISOString();
  const deadline = now() + (o.deadlineMs ?? 45_000);
  const abort = new AbortController();
  const summary: RunSummary = { runId: null, trigger: o.trigger, startedAt, finishedAt: startedAt, targetsRun: [], targetsSkipped: [], pulled: 0, accepted: 0, dropped: emptyDropped(), tasksCreated: [], errors: [] };

  const targets = o.targets ?? (await loadTargets(o.service));
  const sources = o.sources ?? [exaFeedSource(), rssFeedSource(await loadRssFeeds(o.service))];
  const configured = sources.filter((s) => s.isConfigured());
  if (!configured.length) summary.errors.push("no source is configured (EXA_API_KEY missing and no active RSS feeds)");

  let runId: string | null = null;
  if (!o.dryRun) {
    const { data } = await o.service.from("research_feed_runs").insert({ trigger: o.trigger, started_at: startedAt, status: "running" }).select("id").single();
    runId = (data as { id: string } | null)?.id ?? null;
  }
  summary.runId = runId;

  const known = await loadKnownKeys(o.service);
  const limit = o.limitPerTarget ?? 10;

  for (const target of targets) {
    if (now() > deadline) { summary.targetsSkipped.push(target.id); continue; }
    const remaining = Math.max(1000, deadline - now());
    const timer = setTimeout(() => abort.abort(), remaining);
    let cands: Candidate[] = [];
    try {
      for (const src of configured) {
        try {
          const raws = await src.pull(target, { limit, signal: abort.signal });
          summary.pulled += raws.length;
          for (const r of raws) cands.push(...toCandidates(r, target));
        } catch (e) {
          summary.errors.push(`${src.kind}/${target.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } finally {
      clearTimeout(timer);
    }
    cands = flagKnown(dedupeBatch(cands), known);
    const accepted = cands.filter(isAccepted);
    for (const c of cands) for (const f of c.flags) if (HARD_DROP.includes(f)) { summary.dropped[f] += 1; break; }
    summary.accepted += accepted.length;
    summary.targetsRun.push(target.id);
    // Tonight's accepted keys become "prior" for the next target (same business, two metros).
    for (const c of accepted) { known.prior.add(c.dedupeKey); if (c.canonicalDomain) known.prior.add(`d:${c.canonicalDomain}`); if (c.phoneE164) known.prior.add(`p:${c.phoneE164}`); }

    if (o.dryRun) continue;
    const rows = cands.map((c) => ({ run_id: runId, target_id: target.id, source_kind: c.sourceKind, source_url: c.sourceUrl, business_name: c.name, website: c.website, canonical_domain: c.canonicalDomain, phone_e164: c.phoneE164, city: c.city, state: c.state, category: c.category, snippet: c.snippet, published_at: c.publishedAt, identity_label: c.identityLabel, dedupe_key: c.dedupeKey, quality_flags: c.flags, accepted: isAccepted(c) }));
    const inserted = rows.length ? await o.service.from("research_feed_findings").insert(rows).select("id, dedupe_key, accepted") : { data: [], error: null };
    if (inserted.error) summary.errors.push(`persist/${target.id}: ${inserted.error.message}`);
    await o.service.from("research_feed_targets").update({ last_run_at: new Date(now()).toISOString() }).eq("id", target.id);

    if ((o.fileTasks ?? true) && accepted.length) {
      try {
        const task = await createTask("hyperagent", {
          title: `Qualify ${accepted.length} new ${target.vertical} prospect${accepted.length === 1 ? "" : "s"} — ${target.city}, ${target.state}`,
          owner_agent: "atlas",
          reviewer_agent: "hyperagent",
          requires_review: true,
          priority: "normal",
          context: taskContext(target, accepted),
        });
        summary.tasksCreated.push({ taskId: task.id, targetId: target.id, findings: accepted.length });
        const ids = ((inserted.data ?? []) as { id: string; accepted: boolean }[]).filter((r) => r.accepted).map((r) => r.id);
        if (ids.length) await o.service.from("research_feed_findings").update({ task_id: task.id }).in("id", ids);
      } catch (e) {
        summary.errors.push(`task/${target.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  summary.finishedAt = new Date(now()).toISOString();
  if (!o.dryRun && runId) {
    await o.service.from("research_feed_runs").update({ finished_at: summary.finishedAt, status: summary.errors.length ? "completed_with_errors" : "completed", targets_run: summary.targetsRun, targets_skipped: summary.targetsSkipped, pulled: summary.pulled, accepted: summary.accepted, dropped: summary.dropped, tasks_created: summary.tasksCreated.length, errors: summary.errors }).eq("id", runId);
  }
  if (!o.dryRun) emitIntegrationEvent("prospect_feed.run_completed", { run_id: runId, accepted: summary.accepted, pulled: summary.pulled, tasks_created: summary.tasksCreated.length, errors: summary.errors.length });
  return summary;
}

/** Markdown the agents read. Honest labels, every source link, and the rules of engagement. */
export function taskContext(target: FeedTarget, accepted: Candidate[]): string {
  const lines = [
    `Nightly prospect feed — ${target.vertical} · ${target.city}, ${target.state}. ${accepted.length} new candidate${accepted.length === 1 ? "" : "s"} passed dedup, geo (city+state, US-only) and chain/junk filters.`,
    ``,
    `These are CANDIDATES, not confirmed businesses. Labels: corroborated = site domain names the business and a phone/city agrees; name_only = a name plus one contact fact; unverified = extracted from a news item. Qualify each one (is it a real, locally-owned ${target.vertical} business in ${target.city}, ${target.state}? who owns it? best contact path?) and post the result. Do not contact anyone from this task — outreach is a separate, human-approved step.`,
    ``,
    ...accepted.map((c, i) => [
      `${i + 1}. **${c.name}** · ${c.identityLabel}`,
      `   ${[c.website, c.phoneE164, [c.city, c.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}`,
      `   source: ${c.sourceUrl}${c.publishedAt ? ` (${c.publishedAt.slice(0, 10)})` : ""}`,
      c.snippet ? `   "${c.snippet.slice(0, 220)}${c.snippet.length > 220 ? "…" : ""}"` : null,
    ].filter(Boolean).join("\n")),
  ];
  return lines.join("\n").slice(0, 20000);
}
