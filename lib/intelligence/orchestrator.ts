import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { ensureTrackedQueries } from "./queryGeneration";
import { executeProviderCheck, isEngineEnabled, isProviderConfigured, type Platform } from "./providers";
import { resolveEntityMatch, statusFromMatches } from "./entityResolution";
import { computePresenceScore, ENGINE_METHODOLOGY_VERSION } from "./scoring";
import { deriveFindings, applyFindingsForScan } from "./findings";
import { applyRecommendationsForScan } from "./recommendations";

const ALL_PLATFORMS: Platform[] = ["chatgpt", "claude", "perplexity", "grok", "google_ai"];

export type ScanOptions = {
  businessId: string;
  triggeredByUserId: string;
  maxChecks: number; // HARD cap on total provider executions, enforced server-side regardless of caller input
  platforms?: Platform[];
  maxCompetitors?: number;
};

export type ScanSummary = {
  projectId: string;
  engineEnabled: boolean;
  jobsCreated: number;
  jobsSucceeded: number;
  jobsSkippedNotConfigured: number;
  jobsFailed: number;
  observationsCreated: number;
  presenceScore: number | null;
  findingsGenerated: number;
};

/** This is the ADMIN/TEAM-ONLY manual controlled scan (item 37). Never
 * called from customer-facing code, never exposed to a customer. */
export async function runVisibilityScan(opts: ScanOptions): Promise<ScanSummary> {
  const HARD_TEST_LIMIT = 10; // absolute development/test cap -- see report item 38, never exceeded regardless of caller input
  const maxChecks = Math.max(1, Math.min(opts.maxChecks, HARD_TEST_LIMIT));
  const platforms = (opts.platforms ?? ALL_PLATFORMS).filter((p) => ALL_PLATFORMS.includes(p));
  const maxCompetitors = Math.max(0, Math.min(opts.maxCompetitors ?? 1, 2));

  const service = createSupabaseServiceClient();

  const { data: business } = await service.from("businesses").select("id, legal_name, website, primary_category").eq("id", opts.businessId).maybeSingle();
  if (!business) throw new Error("Business not found.");

  const { data: locationRow } = await service.from("business_locations").select("id, cities").eq("business_id", opts.businessId).maybeSingle();
  const locationContext = locationRow?.cities?.[0] ?? null;

  const { data: project, error: projectErr } = await service
    .from("projects")
    .insert({ business_id: opts.businessId, status: "running", scan_type: "visibility_check", location_id: locationRow?.id ?? null })
    .select("id")
    .single();
  if (projectErr || !project) throw new Error(`Could not create scan run: ${projectErr?.message}`);

  await service.from("project_status_history").insert({ project_id: project.id, status: "running", changed_by: opts.triggeredByUserId, note: "Manual visibility scan started." });

  const trackedQueryIds = await ensureTrackedQueries(opts.businessId, locationRow?.id ?? null);
  const { data: trackedQueries } = await service
    .from("tracked_queries")
    .select("id, query_text, location_id")
    .in("id", trackedQueryIds.length > 0 ? trackedQueryIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("status", "active")
    .order("priority", { ascending: false })
    .limit(maxChecks);

  const { data: competitors } = maxCompetitors > 0
    ? await service.from("competitors").select("id, name, website").eq("business_id", opts.businessId).limit(maxCompetitors)
    : { data: [] };

  let budget = maxChecks;
  let jobsCreated = 0;
  let jobsSucceeded = 0;
  let jobsSkippedNotConfigured = 0;
  let jobsFailed = 0;
  let observationsCreated = 0;

  const businessContext = { name: business.legal_name, website: business.website, category: business.primary_category };

  outer: for (const tq of trackedQueries ?? []) {
    for (const platform of platforms) {
      if (budget <= 0) break outer;
      budget -= 1;
      jobsCreated += 1;

      const started = Date.now();
      const { data: job } = await service
        .from("ai_check_jobs")
        .insert({ project_id: project.id, tracked_query_id: tq.id, platform, status: "running", started_at: new Date().toISOString(), attempt_count: 1 })
        .select("id")
        .maybeSingle();

      const configured = isProviderConfigured(platform);
      const result = await executeProviderCheck(platform, { query: tq.query_text, locationContext, businessContext: { name: business.legal_name, website: business.website, category: business.primary_category } });

      if (result.status === "not_configured") {
        jobsSkippedNotConfigured += 1;
        if (job) await service.from("ai_check_jobs").update({ status: "skipped_not_configured", completed_at: new Date().toISOString(), duration_ms: Date.now() - started }).eq("id", job.id);
        // Still write an observation record so the customer's Query
        // Explorer can honestly show "Not Yet Tested" for this tracked
        // query rather than showing nothing.
        await writeObservation({ businessId: opts.businessId, projectId: project.id, trackedQueryId: tq.id, platform, queryText: tq.query_text, locationId: tq.location_id, competitorId: null, status: "not_tested", observedPosition: null, evidenceText: configured ? null : `Provider not configured.` });
        observationsCreated += 1;
        continue;
      }

      if (result.status !== "success") {
        jobsFailed += 1;
        if (job) await service.from("ai_check_jobs").update({ status: "failed", error_text: result.error, completed_at: new Date().toISOString(), duration_ms: Date.now() - started }).eq("id", job.id);
        await writeObservation({ businessId: opts.businessId, projectId: project.id, trackedQueryId: tq.id, platform, queryText: tq.query_text, locationId: tq.location_id, competitorId: null, status: "error", observedPosition: null, evidenceText: result.error });
        observationsCreated += 1;
        continue;
      }

      jobsSucceeded += 1;
      if (job) await service.from("ai_check_jobs").update({ status: "completed", completed_at: new Date().toISOString(), duration_ms: Date.now() - started }).eq("id", job.id);

      const matches = result.returnedBusinesses.map((rb) => resolveEntityMatch({ name: businessContext.name, website: businessContext.website }, rb));
      const yourStatus = statusFromMatches(matches);
      await writeObservation({
        businessId: opts.businessId,
        projectId: project.id,
        trackedQueryId: tq.id,
        platform,
        queryText: tq.query_text,
        locationId: tq.location_id,
        competitorId: null,
        status: yourStatus,
        observedPosition: null, // v1 adapters don't extract a reliable ordered position -- never invented
        evidenceText: result.responseText?.slice(0, 500) ?? null,
        sourceUrl: null,
      });
      observationsCreated += 1;

      for (const comp of competitors ?? []) {
        if (budget <= 0) break;
        budget -= 1;
        const compMatches = result.returnedBusinesses.map((rb) => resolveEntityMatch({ name: comp.name, website: comp.website }, rb));
        const compStatus = statusFromMatches(compMatches);
        await writeObservation({
          businessId: opts.businessId,
          projectId: project.id,
          trackedQueryId: tq.id,
          platform,
          queryText: tq.query_text,
          locationId: tq.location_id,
          competitorId: comp.id,
          status: compStatus,
          observedPosition: null,
          evidenceText: result.responseText?.slice(0, 500) ?? null,
        });
        observationsCreated += 1;
      }
    }
  }

  await service
    .from("projects")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", project.id);
  await service.from("project_status_history").insert({ project_id: project.id, status: "completed", changed_by: opts.triggeredByUserId, note: `Scan finished: ${jobsSucceeded} succeeded, ${jobsSkippedNotConfigured} not configured, ${jobsFailed} failed.` });

  // Scoring + findings + recommendations, scoped to THIS scan's own
  // observations only (never mixing in older scans' rows into "this
  // scan's" score computation).
  const { data: freshObservations } = await service
    .from("ai_visibility_observations")
    .select("id, tracked_query_id, query_text, platform, status, competitor_id")
    .eq("project_id", project.id);

  const yourObs = (freshObservations ?? []).filter((o) => !o.competitor_id);
  const compObs = (freshObservations ?? []).filter((o) => o.competitor_id);

  const presenceScore = computePresenceScore(yourObs);
  if (presenceScore !== null) {
    await service.from("presence_scores").insert({
      business_id: opts.businessId,
      project_id: project.id,
      overall_score: presenceScore,
      methodology_version: ENGINE_METHODOLOGY_VERSION,
    });
  }

  const generatedFindings = deriveFindings(yourObs as any, compObs as any);
  await applyFindingsForScan(opts.businessId, project.id, generatedFindings);
  await applyRecommendationsForScan(opts.businessId, project.id);

  return {
    projectId: project.id,
    engineEnabled: isEngineEnabled(),
    jobsCreated,
    jobsSucceeded,
    jobsSkippedNotConfigured,
    jobsFailed,
    observationsCreated,
    presenceScore,
    findingsGenerated: generatedFindings.length,
  };
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
  observedPosition: number | null;
  evidenceText: string | null;
  sourceUrl?: string | null;
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
    observed_position: params.observedPosition,
    evidence_text: params.evidenceText,
    source_url: params.sourceUrl ?? null,
    checked_at: params.status === "not_tested" ? null : new Date().toISOString(),
  });
  // 23505 = unique_violation on the idempotency index -- a retry of the
  // exact same (project, tracked_query, platform, competitor) tuple. Not
  // an error: the correct behavior is to leave the original observation
  // untouched rather than create a misleading duplicate measurement.
  if (error && (error as any).code !== "23505") {
    throw new Error(`Could not write observation: ${error.message}`);
  }
}
