import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { ensureTrackedQueries } from "./queryGeneration";
import { executeProviderCheck, isEngineEnabled, providerConfigurationState, requiredEnvVarFor, type Platform, type FailureCode } from "./providers";
import { resolveEntityMatch, statusFromMatches, type MatchConfidence } from "./entityResolution";
import { computePresenceScore, computeEvidenceConfidence, ENGINE_METHODOLOGY_VERSION } from "./scoring";
import { deriveFindings, applyFindingsForScan } from "./findings";
import { applyRecommendationsForScan } from "./recommendations";
import { recordDiscoveredCompetitors } from "./competitorDiscovery";

export const ALL_PLATFORMS: Platform[] = ["chatgpt", "claude", "perplexity", "grok", "google_ai"];

// PRODUCTION SAFETY LIMITS -- configurable via env, but every one has a
// hard ceiling in code that a request can never exceed. A UI request must
// never be able to create unbounded provider spend.
const HARD_MAX_CHECKS_PER_SCAN = 10; // absolute dev/test ceiling (item 38)
const HARD_MAX_SPEND_CENTS_PER_SCAN = 100; // $1.00 absolute ceiling per manual scan
function configuredMaxChecks(): number {
  const n = Number(process.env.AI_VISIBILITY_MAX_CHECKS_PER_SCAN);
  return Number.isFinite(n) && n > 0 ? Math.min(n, HARD_MAX_CHECKS_PER_SCAN) : HARD_MAX_CHECKS_PER_SCAN;
}
function configuredMaxSpendCents(): number {
  const n = Number(process.env.AI_VISIBILITY_MAX_SPEND_CENTS_PER_SCAN);
  return Number.isFinite(n) && n > 0 ? Math.min(n, HARD_MAX_SPEND_CENTS_PER_SCAN) : HARD_MAX_SPEND_CENTS_PER_SCAN;
}

export type ScanOptions = {
  businessId: string;
  triggeredByUserId: string;
  maxChecks?: number;
  maxSpendCents?: number;
  platforms?: Platform[];
  maxCompetitors?: number;
  /** Limit to specific tracked query ids (owner-controlled partial scan). */
  trackedQueryIds?: string[];
};

export type ScanSummary = {
  projectId: string;
  engineEnabled: boolean;
  providerStates: Record<Platform, "ready" | "not_configured" | "disabled">;
  requiredEnvVars: string[];
  coverage: { queriesIntended: number; queriesAttempted: number; queriesCompleted: number; checksIntended: number; checksAttempted: number; checksCompleted: number };
  jobsSucceeded: number;
  jobsSkippedNotConfigured: number;
  jobsFailed: number;
  failureCodes: Partial<Record<FailureCode, number>>;
  observationsCreated: number;
  estimatedCostCents: number;
  costIsEstimate: true;
  stoppedReason: "completed" | "COST_LIMIT_REACHED" | "CHECK_LIMIT_REACHED";
  presenceScore: number | null;
  evidenceConfidence: string | null;
  findings: { opened: number; refreshed: number; reopened: number; resolved: number; leftOpenNotRetested: number };
  recommendationsCreated: number;
  competitorsDiscovered: number;
};

/** ADMIN/TEAM-ONLY manual controlled scan. Never customer-callable. */
export async function runVisibilityScan(opts: ScanOptions): Promise<ScanSummary> {
  const maxChecks = Math.max(1, Math.min(opts.maxChecks ?? configuredMaxChecks(), configuredMaxChecks()));
  const maxSpendCents = Math.max(1, Math.min(opts.maxSpendCents ?? configuredMaxSpendCents(), configuredMaxSpendCents()));
  const platforms = (opts.platforms ?? ALL_PLATFORMS).filter((p) => ALL_PLATFORMS.includes(p));
  const maxCompetitors = Math.max(0, Math.min(opts.maxCompetitors ?? 1, 2));

  const service = createSupabaseServiceClient();

  const { data: business } = await service.from("businesses").select("id, legal_name, website, primary_category").eq("id", opts.businessId).maybeSingle();
  if (!business) throw new Error("Business not found.");

  const { data: locationRow } = await service.from("business_locations").select("id, cities").eq("business_id", opts.businessId).maybeSingle();
  const locationContext = locationRow?.cities?.[0] ?? null;

  // Tracked queries: generate/reuse (allowance-enforced inside), then
  // optionally narrow to an owner-selected subset for a partial scan.
  const generatedIds = await ensureTrackedQueries(opts.businessId, locationRow?.id ?? null);
  let tqQuery = service.from("tracked_queries").select("id, query_text, location_id").eq("business_id", opts.businessId).eq("status", "active").order("priority", { ascending: false });
  if (opts.trackedQueryIds && opts.trackedQueryIds.length > 0) tqQuery = tqQuery.in("id", opts.trackedQueryIds);
  else if (generatedIds.length > 0) tqQuery = tqQuery.in("id", generatedIds);
  const { data: trackedQueriesAll } = await tqQuery;
  const queriesFitting = Math.max(1, Math.floor(maxChecks / Math.max(1, platforms.length)));
  const trackedQueries = (trackedQueriesAll ?? []).slice(0, queriesFitting);

  const { data: competitors } = maxCompetitors > 0
    ? await service.from("competitors").select("id, name, website").eq("business_id", opts.businessId).in("verification_status", ["verified", "unverified"]).limit(maxCompetitors)
    : { data: [] as { id: string; name: string; website: string | null }[] };

  const checksIntended = Math.min(maxChecks, trackedQueries.length * platforms.length);

  const { data: project, error: projectErr } = await service
    .from("projects")
    .insert({
      business_id: opts.businessId,
      status: "running",
      scan_type: "visibility_check",
      location_id: locationRow?.id ?? null,
      queries_intended: trackedQueries.length,
      platforms_intended: platforms,
      checks_intended: checksIntended,
      metadata: { triggered_by: opts.triggeredByUserId, max_checks: maxChecks, max_spend_cents: maxSpendCents, partial: Boolean(opts.trackedQueryIds?.length) },
    })
    .select("id")
    .single();
  if (projectErr || !project) throw new Error(`Could not create scan run: ${projectErr?.message}`);
  await service.from("project_status_history").insert({ project_id: project.id, status: "running", changed_by: opts.triggeredByUserId, note: `Manual visibility scan started (${trackedQueries.length} queries x ${platforms.length} platforms, cap ${maxChecks} checks / ${maxSpendCents}c).` });

  const providerStates = Object.fromEntries(ALL_PLATFORMS.map((p) => [p, providerConfigurationState(p)])) as Record<Platform, "ready" | "not_configured" | "disabled">;
  const requiredEnvVars = ALL_PLATFORMS.filter((p) => providerStates[p] === "not_configured").map(requiredEnvVarFor);

  let checksAttempted = 0;
  let checksCompleted = 0;
  let jobsSucceeded = 0;
  let jobsSkippedNotConfigured = 0;
  let jobsFailed = 0;
  let observationsCreated = 0;
  let estimatedCostCents = 0;
  let competitorsDiscovered = 0;
  const failureCodes: Partial<Record<FailureCode, number>> = {};
  const retested: { queryKey: string; platform: string }[] = [];
  const queriesTouched = new Set<string>();
  const queriesCompleted = new Set<string>();
  let stoppedReason: ScanSummary["stoppedReason"] = "completed";

  const businessContext = { name: business.legal_name, website: business.website, category: business.primary_category };

  outer: for (const tq of trackedQueries) {
    for (const platform of platforms) {
      if (checksAttempted >= maxChecks) {
        stoppedReason = "CHECK_LIMIT_REACHED";
        break outer;
      }
      if (estimatedCostCents >= maxSpendCents) {
        stoppedReason = "COST_LIMIT_REACHED";
        break outer;
      }
      checksAttempted += 1;
      queriesTouched.add(tq.id);

      const started = Date.now();
      const { data: job } = await service
        .from("ai_check_jobs")
        .insert({ project_id: project.id, tracked_query_id: tq.id, platform, status: "running", started_at: new Date().toISOString(), attempt_count: 1 })
        .select("id")
        .maybeSingle();

      const result = await executeProviderCheck(platform, { query: tq.query_text, locationContext, businessContext });
      const durationMs = Date.now() - started;
      if (result.failureCode) failureCodes[result.failureCode] = (failureCodes[result.failureCode] ?? 0) + 1;

      if (result.status === "not_configured") {
        jobsSkippedNotConfigured += 1;
        if (job) await service.from("ai_check_jobs").update({ status: "skipped_not_configured", failure_code: result.failureCode, error_text: result.error, completed_at: new Date().toISOString(), duration_ms: durationMs, provider_model: result.metadata.model }).eq("id", job.id);
        await writeObservation({ businessId: opts.businessId, projectId: project.id, trackedQueryId: tq.id, platform, queryText: tq.query_text, locationId: tq.location_id, competitorId: null, status: "not_tested", matchConfidence: null, evidenceText: result.error, citationUrls: null, failureCode: result.failureCode });
        observationsCreated += 1;
        continue;
      }

      if (result.status !== "success") {
        jobsFailed += 1;
        if (job) await service.from("ai_check_jobs").update({ status: "failed", failure_code: result.failureCode ?? "UNKNOWN", error_text: result.error, completed_at: new Date().toISOString(), duration_ms: durationMs, provider_model: result.metadata.model }).eq("id", job.id);
        await writeObservation({ businessId: opts.businessId, projectId: project.id, trackedQueryId: tq.id, platform, queryText: tq.query_text, locationId: tq.location_id, competitorId: null, status: "error", matchConfidence: null, evidenceText: result.error, citationUrls: null, failureCode: result.failureCode });
        observationsCreated += 1;
        continue;
      }

      // Real provider response.
      jobsSucceeded += 1;
      checksCompleted += 1;
      queriesCompleted.add(tq.id);
      estimatedCostCents += result.metadata.costEstimateCents ?? 0;
      if (job) {
        await service.from("ai_check_jobs").update({ status: "completed", completed_at: new Date().toISOString(), duration_ms: durationMs, provider_model: result.metadata.model, usage_metadata: result.metadata.usage, cost_estimate_cents: result.metadata.costEstimateCents, cost_is_estimate: true }).eq("id", job.id);
      }

      let matches: MatchConfidence[];
      try {
        matches = result.returnedBusinesses.map((rb) => resolveEntityMatch({ name: businessContext.name, website: businessContext.website }, rb));
      } catch {
        failureCodes.ENTITY_EXTRACTION_ERROR = (failureCodes.ENTITY_EXTRACTION_ERROR ?? 0) + 1;
        await writeObservation({ businessId: opts.businessId, projectId: project.id, trackedQueryId: tq.id, platform, queryText: tq.query_text, locationId: tq.location_id, competitorId: null, status: "inconclusive", matchConfidence: null, evidenceText: result.responseText?.slice(0, 800) ?? null, citationUrls: result.citationUrls, failureCode: "ENTITY_EXTRACTION_ERROR" });
        observationsCreated += 1;
        continue;
      }
      const yourStatus = statusFromMatches(matches);
      const bestMatch = pickBestMatch(matches);
      const matchedCandidate = result.returnedBusinesses.find((rb, i) => matches[i] === bestMatch);
      retested.push({ queryKey: tq.id, platform });

      await writeObservation({
        businessId: opts.businessId,
        projectId: project.id,
        trackedQueryId: tq.id,
        platform,
        queryText: tq.query_text,
        locationId: tq.location_id,
        competitorId: null,
        status: yourStatus,
        matchConfidence: bestMatch,
        evidenceText: result.responseText?.slice(0, 800) ?? null,
        citationUrls: result.citationUrls,
        sourceUrl: matchedCandidate?.sourceUrl ?? null,
        businessesReturned: result.returnedBusinesses.map((rb) => ({ name: rb.name, domain: rb.domain, sourceUrl: rb.sourceUrl })),
        failureCode: null,
      });
      observationsCreated += 1;

      // Competitor observations reuse the SAME provider response (no extra
      // provider call, no extra cost) -- genuinely comparable by construction.
      for (const comp of competitors ?? []) {
        const compMatches = result.returnedBusinesses.map((rb) => resolveEntityMatch({ name: comp.name, website: comp.website }, rb));
        await writeObservation({ businessId: opts.businessId, projectId: project.id, trackedQueryId: tq.id, platform, queryText: tq.query_text, locationId: tq.location_id, competitorId: comp.id, status: statusFromMatches(compMatches), matchConfidence: pickBestMatch(compMatches), evidenceText: result.responseText?.slice(0, 800) ?? null, citationUrls: result.citationUrls, failureCode: null });
        observationsCreated += 1;
      }

      // AI-discovered competitor candidates -> needs_review (never auto-trusted).
      const discovered = await recordDiscoveredCompetitors({ businessId: opts.businessId, businessWebsite: business.website, projectId: project.id, platform, queryText: tq.query_text, candidates: result.returnedBusinesses });
      competitorsDiscovered += discovered.recorded;
    }
  }

  // Scan lifecycle: completed even when providers failed/unconfigured --
  // partial results are always preserved. Coverage is recorded explicitly.
  await service
    .from("projects")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      queries_attempted: queriesTouched.size,
      queries_completed: queriesCompleted.size,
      checks_attempted: checksAttempted,
      checks_completed: checksCompleted,
      estimated_cost_cents: estimatedCostCents,
    })
    .eq("id", project.id);
  await service.from("project_status_history").insert({ project_id: project.id, status: "completed", changed_by: opts.triggeredByUserId, note: `Scan ${stoppedReason}: ${jobsSucceeded} succeeded, ${jobsSkippedNotConfigured} not configured, ${jobsFailed} failed; ~${estimatedCostCents.toFixed(3)}c estimated.` });

  const { data: freshObservations } = await service.from("ai_visibility_observations").select("id, tracked_query_id, query_text, platform, status, competitor_id").eq("project_id", project.id);
  const yourObs = (freshObservations ?? []).filter((o) => !o.competitor_id);
  const compObs = (freshObservations ?? []).filter((o) => o.competitor_id);

  // Score + evidence sufficiency, both from THIS scan's own observations.
  const presenceScore = computePresenceScore(yourObs);
  const evidence = computeEvidenceConfidence(yourObs);
  if (presenceScore !== null) {
    await service.from("presence_scores").insert({
      business_id: opts.businessId,
      project_id: project.id,
      overall_score: presenceScore,
      methodology_version: ENGINE_METHODOLOGY_VERSION,
      evidence_confidence: evidence.confidence,
      valid_observation_count: evidence.validCount,
      queries_tested_count: evidence.queriesTested,
      platforms_tested_count: evidence.platformsTested,
      error_inconclusive_count: evidence.errorInconclusiveCount,
    });
  }

  const generatedFindings = deriveFindings(yourObs as any, compObs as any);
  const findings = await applyFindingsForScan(opts.businessId, project.id, generatedFindings, retested);
  const recs = await applyRecommendationsForScan(opts.businessId, project.id);

  return {
    projectId: project.id,
    engineEnabled: isEngineEnabled(),
    providerStates,
    requiredEnvVars,
    coverage: { queriesIntended: trackedQueries.length, queriesAttempted: queriesTouched.size, queriesCompleted: queriesCompleted.size, checksIntended, checksAttempted, checksCompleted },
    jobsSucceeded,
    jobsSkippedNotConfigured,
    jobsFailed,
    failureCodes,
    observationsCreated,
    estimatedCostCents,
    costIsEstimate: true,
    stoppedReason,
    presenceScore,
    evidenceConfidence: presenceScore !== null ? evidence.confidence : null,
    findings,
    recommendationsCreated: recs.created,
    competitorsDiscovered,
  };
}

function pickBestMatch(matches: MatchConfidence[]): MatchConfidence | null {
  if (matches.length === 0) return null;
  const order: MatchConfidence[] = ["confirmed_match", "probable_match", "ambiguous", "not_match"];
  for (const o of order) if (matches.includes(o)) return o;
  return null;
}

async function writeObservation(params: {
  businessId: string;
  projectId: string;
  trackedQueryId: string;
  platform: string;
  queryText: string;
  locationId: string | null;
  competitorId: string | null;
  status: string;
  matchConfidence: MatchConfidence | null;
  evidenceText: string | null;
  citationUrls: string[] | null;
  sourceUrl?: string | null;
  businessesReturned?: unknown;
  failureCode: FailureCode | null;
}) {
  const service = createSupabaseServiceClient();
  const { error } = await service.from("ai_visibility_observations").insert({
    business_id: params.businessId,
    project_id: params.projectId,
    tracked_query_id: params.trackedQueryId,
    platform: params.platform,
    query_text: params.queryText,
    location_id: params.locationId,
    competitor_id: params.competitorId,
    status: params.status,
    match_confidence: params.matchConfidence,
    observed_position: null, // never invented -- populate only when a provider returns a genuinely ordered list
    evidence_text: params.evidenceText,
    citation_urls: params.citationUrls,
    source_url: params.sourceUrl ?? null,
    businesses_returned: params.businessesReturned ?? null,
    failure_code: params.failureCode,
    methodology_version: ENGINE_METHODOLOGY_VERSION,
    checked_at: params.status === "not_tested" ? null : new Date().toISOString(),
  });
  // 23505 = idempotency index: same (project, query, platform, competitor)
  // already recorded in this run -- a retry, not a new measurement.
  if (error && (error as any).code !== "23505") throw new Error(`Could not write observation: ${error.message}`);
}
