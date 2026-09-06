import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { buildLeadProfile } from "@/lib/research/LeadProfileBuilder";
import { evaluateCompleteness } from "@/lib/research/CompletenessEvaluator";
import { computeAndSaveAudit } from "@/lib/crm/audit";

// ============================================================
// SFB Sales OS — Lead Research Pipeline V2
//
// A submitted URL is a SEED, not the final answer. buildLeadProfile()
// follows it to the official website, crawls priority pages, discovers
// every contact channel / location / social profile it can find, and keeps
// "source unavailable" (blocked/login-walled) strictly separate from
// "not found" (checked, genuinely absent). Nothing here is fabricated —
// every value traces back to a fetched page or is honestly marked missing.
// ============================================================

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  if (!caller?.team_role) return NextResponse.json({ error: "Team access required." }, { status: 403 });

  const body = await req.json();
  const rawSources: string[] = (body.sources || []).filter((s: string) => s && s.trim());
  const location: string | undefined = body.location;
  const assignedRep: string | undefined = body.assignedRep;
  if (rawSources.length === 0) return NextResponse.json({ error: "At least one source URL is required." }, { status: 400 });

  const service = createSupabaseServiceClient();

  const { data: lead, error: leadError } = await service
    .from("crm_leads")
    .insert({
      source_urls: rawSources,
      pipeline_stage: "researching",
      assigned_rep: assignedRep || null,
      created_by: user.id,
      city: location?.split(",")[0]?.trim() || null,
      state: location?.split(",")[1]?.trim() || null,
    })
    .select("id")
    .single();
  if (leadError || !lead) return NextResponse.json({ error: leadError?.message || "Could not create lead." }, { status: 400 });

  const { data: job } = await service
    .from("crm_research_jobs")
    .insert({ lead_id: lead.id, status: "running", current_step: "Reading submitted sources", started_by: user.id })
    .select("id")
    .single();

  await service.from("crm_activities").insert({ lead_id: lead.id, rep_id: user.id, activity_type: "lead_imported", description: `Lead research started from ${rawSources.length} source(s)` });

  try {
    const { graph } = await buildLeadProfile(rawSources, async (stage) => {
      if (job) await service.from("crm_research_jobs").update({ current_step: stage }).eq("id", job.id);
    });

    // ---- Source checks: SOURCE UNAVAILABLE vs NOT FOUND lives here ----
    for (const check of graph.sourceChecks) {
      await service.from("crm_lead_source_checks").insert({
        lead_id: lead.id,
        source_url: check.sourceUrl,
        source_type: check.sourceType,
        reachable: check.reachable,
        reason: check.reason || null,
      });
    }

    // ---- Contact methods (structured table) ----
    for (const c of graph.contactMethods) {
      await service.from("crm_lead_contact_methods").insert({
        lead_id: lead.id,
        type: c.type,
        value: c.value,
        status: c.status,
        confidence: c.confidence,
        source_url: c.sourceUrl,
      });
    }

    // ---- Locations (multiple records, never collapsed to one string) ----
    for (const l of graph.locations) {
      await service.from("crm_lead_locations").insert({
        lead_id: lead.id,
        name: l.name,
        address: l.address,
        city: l.city,
        state: l.state,
        postal_code: l.postalCode,
        location_type: l.locationType,
        status: l.status,
        confidence: l.confidence,
        source_url: l.sourceUrl,
      });
    }

    // ---- Social profiles ----
    for (const s of graph.socialProfiles) {
      await service.from("crm_lead_social_profiles").insert({
        lead_id: lead.id,
        platform: s.platform,
        handle: s.handle,
        url: s.url,
        display_name: s.displayName,
        status: s.status,
        confidence: s.confidence,
        source_url: s.sourceUrl,
      });
    }

    // ---- Backward-compatible flat evidence rows for the deterministic audit scorer ----
    const primaryLocation = graph.locations.find((l) => l.locationType === "primary");
    const website = graph.contactMethods.find((c) => c.type === "website");
    const phone = graph.contactMethods.find((c) => c.type === "phone");
    const legacyEvidence: { field: string; value: string | null; status: string; confidence: number; sourceUrl: string | null }[] = [
      { field: "business_name", value: graph.businessName?.value || null, status: graph.businessName ? "verified" : "not_found", confidence: graph.businessName ? 0.9 : 0, sourceUrl: graph.businessName?.sourceUrl || null },
      { field: "phone", value: phone?.value || null, status: phone?.status || "not_found", confidence: phone?.confidence || 0, sourceUrl: phone?.sourceUrl || null },
      { field: "website", value: website?.value || null, status: website?.status || "not_found", confidence: website?.confidence || 0, sourceUrl: website?.sourceUrl || null },
      { field: "category", value: graph.category, status: graph.category ? "verified" : "not_found", confidence: graph.category ? 0.7 : 0, sourceUrl: null },
      { field: "location", value: primaryLocation ? [primaryLocation.city, primaryLocation.state].filter(Boolean).join(", ") : null, status: primaryLocation?.status || "not_found", confidence: primaryLocation?.confidence || 0, sourceUrl: primaryLocation?.sourceUrl || null },
      { field: "structured_data", value: graph.signals.hasJsonLd ? "present" : "absent", status: graph.signals.hasJsonLd ? "verified" : "not_found", confidence: graph.signals.hasJsonLd ? 1 : 0, sourceUrl: null },
      { field: "https", value: graph.signals.hasHttps ? "yes" : "no", status: graph.signals.hasHttps ? "verified" : "not_found", confidence: graph.signals.hasHttps ? 1 : 0, sourceUrl: null },
      { field: "meta_description", value: graph.signals.hasMetaDescription ? "present" : "absent", status: graph.signals.hasMetaDescription ? "verified" : "not_found", confidence: graph.signals.hasMetaDescription ? 1 : 0, sourceUrl: null },
      { field: "aggregate_rating", value: graph.signals.hasAggregateRating ? "present" : "absent", status: graph.signals.hasAggregateRating ? "verified" : "not_found", confidence: graph.signals.hasAggregateRating ? 1 : 0, sourceUrl: null },
      { field: "social_profiles", value: graph.socialProfiles.length > 0 ? graph.socialProfiles.map((s) => s.platform).join(",") : "none", status: graph.socialProfiles.length > 0 ? "verified" : "not_found", confidence: graph.socialProfiles.length > 0 ? 1 : 0, sourceUrl: null },
    ];
    for (const e of legacyEvidence) {
      await service.from("crm_lead_evidence").insert({
        lead_id: lead.id,
        field_name: e.field,
        field_value: e.value,
        status: e.status,
        confidence: e.confidence,
        source_url: e.sourceUrl,
        source_type: e.sourceUrl ? "website" : null,
        research_pass: 8,
      });
    }

    // ---- Completeness scorecard ----
    const completeness = evaluateCompleteness(graph);

    const readyToCall = (phone && phone.status !== "not_found") || (website && website.status !== "not_found");
    await service
      .from("crm_leads")
      .update({
        business_name: graph.businessName?.value || null,
        website: website?.value || null,
        phone: phone?.value || null,
        category: graph.category,
        description: graph.description,
        services: graph.services,
        owner_name: graph.ownerName,
        service_area: graph.locations.filter((l) => l.locationType === "service_area").map((l) => l.city).filter(Boolean).join(", ") || null,
        research_completeness: completeness.overallPercent,
        research_completeness_breakdown: completeness.breakdown,
        last_researched_at: new Date().toISOString(),
        pipeline_stage: readyToCall ? "ready_to_call" : "researching",
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    if (job) await service.from("crm_research_jobs").update({ status: "completed", current_step: "Complete", completed_at: new Date().toISOString() }).eq("id", job.id);
    await service.from("crm_activities").insert({ lead_id: lead.id, rep_id: user.id, activity_type: "research_completed", description: `Research complete — ${completeness.overallPercent}% completeness` });

    // ---- Deterministic AI Presence audit + opportunity (shared lib, no duplicated scoring logic) ----
    const auditResult = await computeAndSaveAudit(lead.id, user.id);

    return NextResponse.json({ leadId: lead.id, completeness: completeness.overallPercent, overallScore: auditResult.overall, offer: auditResult.opportunity.primary });
  } catch (err) {
    if (job) await service.from("crm_research_jobs").update({ status: "failed", current_step: err instanceof Error ? err.message : "Research failed" }).eq("id", job.id);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Research failed." }, { status: 400 });
  }
}
