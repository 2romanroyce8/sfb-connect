import { NextRequest } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { buildLeadProfile } from "@/lib/research/LeadProfileBuilder";
import { evaluateCompleteness } from "@/lib/research/CompletenessEvaluator";
import { progressForStage, type ResearchStage } from "@/lib/research/jobProgress";
import { reconcileGraph } from "@/lib/research/reconcile";
import { assertOk } from "@/lib/supabase/assertOk";
import { profileColumns, persistProfileEntities } from "@/lib/research/persistProfile";
import type { BusinessGraph } from "@/lib/research/types";

function sseEvent(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// "Research More" re-runs discovery with the original sources plus any
// additional ones the rep adds, and merges into the SAME staged result
// rather than creating a duplicate research entry. Streams live stage
// progress the same way the initial import does, backed by the same
// crm_research_jobs row shape (research_result_id set from the start here,
// since the result already exists).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });

  const { data: result } = await supabase.from("crm_research_results").select("*").eq("id", params.id).single();
  if (!result) return new Response(JSON.stringify({ error: "Research result not found or not accessible." }), { status: 404 });

  const body = await req.json().catch(() => ({}));
  const additionalSources: string[] = (body.additionalSources || []).filter((s: string) => s && s.trim());
  const allSources = Array.from(new Set([...(result.source_urls as string[]), ...additionalSources]));

  const service = createSupabaseServiceClient();
  const startedAt = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const push = (data: unknown) => controller.enqueue(new TextEncoder().encode(sseEvent(data)));

      const { data: job, error: jobError } = await service
        .from("crm_research_jobs")
        .insert({
          started_by: user.id,
          started_for: result.business_name || allSources[0],
          research_result_id: result.id,
          status: "running",
          current_step: "QUEUED",
          progress_percent: progressForStage("QUEUED"),
          sources_found: (result.source_urls as string[]).length,
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
        const { graph } = await buildLeadProfile(allSources, onStage);
        const completeness = evaluateCompleteness(graph);
        const website = graph.contactMethods.find((c) => c.type === "website");
        const phone = graph.contactMethods.find((c) => c.type === "phone");
        const email = graph.contactMethods.find((c) => c.type === "email");

        const profile = reconcileGraph(graph, allSources[0]);
        const { error } = await service
          .from("crm_research_results")
          .update({
            ...profileColumns(profile),
            source_urls: allSources,
            business_name: profile.entities.business?.name ?? profile.entities.person?.name ?? profile.entities.business?.candidates[0]?.value ?? result.business_name,
            website: (profile.website.status === "CONFIRMED" || profile.website.status === "UNCERTAIN" ? profile.website.value : website?.value) || result.website,
            phone: phone?.value || result.phone,
            email: email?.value || result.email,
            category: graph.category || result.category,
            description: graph.description || result.description,
            services: graph.services.length > 0 ? graph.services : result.services,
            owner_name: profile.entities.person?.name ?? graph.ownerName ?? result.owner_name,
            research_completeness: completeness.overallPercent,
            research_completeness_breakdown: completeness.breakdown,
            graph_json: graph as unknown as BusinessGraph,
            updated_at: new Date().toISOString(),
          })
          .eq("id", params.id);

        if (error) {
          await service
            .from("crm_research_jobs")
            .update({ status: "failed", error_message: error.message, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("id", job.id);
          push({ type: "error", jobId: job.id, message: error.message });
          controller.close();
          return;
        }

        await persistProfileEntities(service, params.id, profile);

        assertOk(
          await service
            .from("crm_research_jobs")
            .update({ status: "completed", current_step: "COMPLETE", progress_percent: 100, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("id", job.id),
          "finalize research-more job",
          { jobId: job.id }
        );

        push({
          type: "done",
          jobId: job.id,
          resultId: params.id,
          completeness: completeness.overallPercent,
          breakdown: completeness.breakdown,
          verifiedCount: completeness.checklist.filter((c) => c.found).length,
          sourcesCheckedCount: graph.sourceChecks.length,
          needsReviewCount: completeness.checklist.filter((c) => c.required && !c.found).length,
          elapsedMs: Date.now() - startedAt,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Research failed.";
        const { error: failWriteError } = await service
          .from("crm_research_jobs")
          .update({ status: "failed", error_code: "RESEARCH_EXCEPTION", error_message: message, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", job.id);
        if (failWriteError) console.error("[write-failed] mark research-more job failed", { jobId: job.id, error: failWriteError.message });
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
