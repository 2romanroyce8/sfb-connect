import { NextRequest } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { buildLeadProfile, type ResearchScope } from "@/lib/research/LeadProfileBuilder";
import { evaluateCompleteness } from "@/lib/research/CompletenessEvaluator";
import { progressForStage, type ResearchStage } from "@/lib/research/jobProgress";
import { classifySeedUrlType } from "@/lib/research/fetchSource";
import type { ResearchInstrumentation } from "@/lib/research/types";

const FACEBOOK_SEED_TYPES = new Set(["vanity", "profile_id", "pages", "people"]);

// Maps ResearchInstrumentation onto the crm_research_jobs row shape, shared
// by both the success and failure write paths so the two can never drift
// out of sync with each other.
function instrumentationColumns(i: ResearchInstrumentation) {
  return {
    seed_url_type: i.seedUrlType,
    facebook_fetch_result: i.facebookFetchResult,
    mbasic_fallback_used: i.mbasicFallbackUsed,
    mbasic_fallback_result: i.mbasicFallbackResult,
    identity_recovered_from_url: i.identityRecoveredFromUrl,
    identity_recovered_from_secondary_source: i.identityRecoveredFromSecondarySource,
    discovery_provider_used: i.discoveryProviderUsed,
    sources_verified: i.sourcesVerified,
  };
}

const VALID_SCOPES: ResearchScope[] = ["public_web", "website_only", "social_profile", "google_business", "quick_contact"];

// ============================================================
// SFB Sales OS — Lead Research Pipeline V2
//
// A submitted URL is a SEED, not the final answer. buildLeadProfile()
// follows it to the official website, crawls priority pages, discovers
// every contact channel / location / social profile it can find, and keeps
// "source unavailable" (blocked/login-walled) strictly separate from
// "not found" (checked, genuinely absent). Nothing here is fabricated —
// every value traces back to a fetched page or is honestly marked missing.
//
// Research and Leads are deliberately two different things: this endpoint
// only ever writes to crm_research_results (a staging area). Nothing
// becomes a crm_leads row until a rep explicitly clicks Save as Lead, so a
// rep can research 50 businesses without polluting the pipeline with ones
// they don't actually want.
//
// This is a real Server-Sent Events stream, not a polling shim: a
// crm_research_jobs row is created and updated live as buildLeadProfile
// actually reaches each stage (via its onStage callback), and every SSE
// event pushed to the client carries the exact same current_step /
// progress_percent / sources_found the DB row was just updated with. If the
// browser reloads mid-run, GET /api/team/research/jobs/active reflects the
// same real state from the DB.
// ============================================================

function sseEvent(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });

  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  if (!caller?.team_role) return new Response(JSON.stringify({ error: "Team access required." }), { status: 403 });

  const body = await req.json();
  const rawSources: string[] = (body.sources || []).filter((s: string) => s && s.trim());
  const location: string | undefined = body.location;
  const scope: ResearchScope = VALID_SCOPES.includes(body.scope) ? body.scope : "public_web";
  if (rawSources.length === 0) return new Response(JSON.stringify({ error: "At least one source URL is required." }), { status: 400 });

  const service = createSupabaseServiceClient();
  const startedAt = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const push = (data: unknown) => controller.enqueue(new TextEncoder().encode(sseEvent(data)));

      const { data: job, error: jobError } = await service
        .from("crm_research_jobs")
        .insert({
          started_by: user.id,
          started_for: rawSources[0],
          status: "running",
          current_step: "QUEUED",
          progress_percent: progressForStage("QUEUED"),
          sources_found: 0,
        })
        .select("id")
        .single();

      if (jobError || !job) {
        push({ type: "error", message: jobError?.message || "Could not start research job." });
        controller.close();
        return;
      }

      push({ type: "job_created", jobId: job.id, stage: "QUEUED", progressPercent: progressForStage("QUEUED"), sourcesFound: 0, elapsedMs: 0 });

      const onStage = async (stage: ResearchStage, meta?: { sourcesFound?: number }) => {
        const progressPercent = progressForStage(stage);
        const sourcesFound = meta?.sourcesFound ?? 0;
        await service
          .from("crm_research_jobs")
          .update({ current_step: stage, progress_percent: progressPercent, sources_found: sourcesFound, updated_at: new Date().toISOString() })
          .eq("id", job.id);
        push({ type: "stage", stage, progressPercent, sourcesFound, elapsedMs: Date.now() - startedAt });
      };

      try {
        const { graph, instrumentation } = await buildLeadProfile(rawSources, onStage, scope);
        const completeness = evaluateCompleteness(graph);
        const website = graph.contactMethods.find((c) => c.type === "website");
        const phone = graph.contactMethods.find((c) => c.type === "phone");
        const email = graph.contactMethods.find((c) => c.type === "email");

        // A job can finish executing (every stage ran) while still not
        // having identified a real business at all -- that's a genuine
        // failure, not a partial success, so we don't create a hollow
        // research_results row for it.
        const identifiedAnything = !!graph.businessName?.value || website?.value || phone?.value || email?.value;
        if (!identifiedAnything) {
          // A Facebook seed that never yielded identity through ANY
          // recovery path (direct fetch, mbasic fallback, URL-text
          // extraction, or wider-web secondary search) is a distinct,
          // honest outcome from a generic "not found" -- we didn't prove
          // the business doesn't exist, we just ran out of public sources
          // that could identify it. Kept out of NOT_FOUND so it can be
          // tracked and reported on separately.
          const isFacebookSeed = FACEBOOK_SEED_TYPES.has(instrumentation.seedUrlType);
          const identityUnrecoverable =
            isFacebookSeed &&
            instrumentation.facebookFetchResult !== "success" &&
            instrumentation.mbasicFallbackResult !== "success" &&
            !instrumentation.identityRecoveredFromUrl &&
            !instrumentation.identityRecoveredFromSecondarySource;
          const errorCode = identityUnrecoverable ? "IDENTITY_UNRECOVERABLE_FROM_PUBLIC_SOURCES" : "NO_IDENTITY_FOUND";
          const reason = identityUnrecoverable
            ? "This Facebook profile's identity could not be recovered from any public source (direct fetch, mbasic fallback, the URL itself, or a wider-web search) — this does not prove the business doesn't exist, only that public sources couldn't identify it."
            : "None of the submitted sources could be identified as a real business — every source was unreachable or returned no usable business information.";
          await service
            .from("crm_research_jobs")
            .update({
              status: "failed",
              error_code: errorCode,
              error_message: reason,
              research_completed: false,
              research_coverage_score: 0,
              ...instrumentationColumns(instrumentation),
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
          push({ type: "error", jobId: job.id, message: reason, errorCode, lastStage: "BUILDING_PROFILE" });
          controller.close();
          return;
        }

        const { data: result, error } = await service
          .from("crm_research_results")
          .insert({
            submitted_by: user.id,
            source_urls: rawSources,
            business_name: graph.businessName?.value || null,
            website: website?.value || null,
            phone: phone?.value || null,
            email: email?.value || null,
            category: graph.category,
            description: graph.description,
            services: graph.services,
            owner_name: graph.ownerName,
            city: location?.split(",")[0]?.trim() || graph.locations.find((l) => l.locationType === "primary")?.city || null,
            state: location?.split(",")[1]?.trim() || graph.locations.find((l) => l.locationType === "primary")?.state || null,
            research_completeness: completeness.overallPercent,
            research_completeness_breakdown: completeness.breakdown,
            graph_json: graph,
            status: "pending",
          })
          .select("id")
          .single();

        if (error || !result) {
          await service
            .from("crm_research_jobs")
            .update({ status: "failed", error_message: error?.message || "Could not save research result.", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("id", job.id);
          push({ type: "error", jobId: job.id, message: error?.message || "Could not save research result." });
          controller.close();
          return;
        }

        await service
          .from("crm_research_jobs")
          .update({
            research_result_id: result.id,
            status: "complete",
            current_step: "COMPLETE",
            progress_percent: 100,
            research_completed: true,
            research_coverage_score: completeness.overallPercent,
            ...instrumentationColumns(instrumentation),
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        push({
          type: "done",
          jobId: job.id,
          resultId: result.id,
          completeness: completeness.overallPercent,
          breakdown: completeness.breakdown,
          verifiedCount: completeness.checklist.filter((c) => c.found).length,
          sourcesCheckedCount: graph.sourceChecks.length,
          needsReviewCount: completeness.checklist.filter((c) => c.required && !c.found).length,
          elapsedMs: Date.now() - startedAt,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Research failed.";
        // buildLeadProfile threw before returning instrumentation — still
        // worth logging the seed's URL shape so a hard-crash failure mode
        // is visible in the same seed_url_type breakdown as a clean
        // "no identity found" outcome, instead of disappearing from it.
        await service
          .from("crm_research_jobs")
          .update({
            status: "failed",
            error_code: "RESEARCH_EXCEPTION",
            error_message: message,
            research_completed: false,
            seed_url_type: rawSources[0] ? classifySeedUrlType(rawSources[0]) : null,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        push({ type: "error", jobId: job.id, message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
