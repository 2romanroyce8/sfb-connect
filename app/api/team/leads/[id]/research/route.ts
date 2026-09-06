import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { buildLeadProfile } from "@/lib/research/LeadProfileBuilder";
import { evaluateCompleteness } from "@/lib/research/CompletenessEvaluator";
import { computeAndSaveAudit } from "@/lib/crm/audit";

type Scope = "full" | "contact" | "locations" | "social" | "website";

// Re-research without forcing a full restart. The rep can ask to refresh
// just contact info, just locations, just socials, or just the website scan
// instead of rerunning everything for one missing field.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: lead } = await supabase.from("crm_leads").select("id, source_urls, website").eq("id", params.id).single();
  if (!lead) return NextResponse.json({ error: "Lead not found or not accessible." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const scope: Scope = body.scope || "full";
  const seeds: string[] = scope === "website" && lead.website ? [lead.website] : lead.source_urls || [];
  if (seeds.length === 0) return NextResponse.json({ error: "No sources available to research." }, { status: 400 });

  const service = createSupabaseServiceClient();
  const { data: job } = await service
    .from("crm_research_jobs")
    .insert({ lead_id: lead.id, status: "running", current_step: "Reading submitted sources", started_by: user.id })
    .select("id")
    .single();

  try {
    const { graph } = await buildLeadProfile(seeds, async (stage) => {
      if (job) await service.from("crm_research_jobs").update({ current_step: stage }).eq("id", job.id);
    });

    if (scope === "full" || scope === "contact") {
      await service.from("crm_lead_contact_methods").delete().eq("lead_id", lead.id);
      for (const c of graph.contactMethods) {
        await service.from("crm_lead_contact_methods").insert({ lead_id: lead.id, type: c.type, value: c.value, status: c.status, confidence: c.confidence, source_url: c.sourceUrl });
      }
    }
    if (scope === "full" || scope === "locations") {
      await service.from("crm_lead_locations").delete().eq("lead_id", lead.id);
      for (const l of graph.locations) {
        await service.from("crm_lead_locations").insert({ lead_id: lead.id, name: l.name, address: l.address, city: l.city, state: l.state, postal_code: l.postalCode, location_type: l.locationType, status: l.status, confidence: l.confidence, source_url: l.sourceUrl });
      }
    }
    if (scope === "full" || scope === "social") {
      await service.from("crm_lead_social_profiles").delete().eq("lead_id", lead.id);
      for (const s of graph.socialProfiles) {
        await service.from("crm_lead_social_profiles").insert({ lead_id: lead.id, platform: s.platform, handle: s.handle, url: s.url, display_name: s.displayName, status: s.status, confidence: s.confidence, source_url: s.sourceUrl });
      }
    }
    if (scope === "full" || scope === "website") {
      const website = graph.contactMethods.find((c) => c.type === "website");
      if (website?.value) await service.from("crm_leads").update({ website: website.value }).eq("id", lead.id);
    }

    await service.from("crm_lead_source_checks").insert(
      graph.sourceChecks.map((c) => ({ lead_id: lead.id, source_url: c.sourceUrl, source_type: c.sourceType, reachable: c.reachable, reason: c.reason || null }))
    );

    if (scope === "full") {
      const phone = graph.contactMethods.find((c) => c.type === "phone");
      const website = graph.contactMethods.find((c) => c.type === "website");
      const completeness = evaluateCompleteness(graph);
      await service
        .from("crm_leads")
        .update({
          business_name: graph.businessName?.value || undefined,
          category: graph.category || undefined,
          description: graph.description || undefined,
          services: graph.services,
          owner_name: graph.ownerName || undefined,
          phone: phone?.value || undefined,
          website: website?.value || undefined,
          research_completeness: completeness.overallPercent,
          research_completeness_breakdown: completeness.breakdown,
          last_researched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", lead.id);
    } else {
      await service.from("crm_leads").update({ last_researched_at: new Date().toISOString() }).eq("id", lead.id);
    }

    if (job) await service.from("crm_research_jobs").update({ status: "completed", current_step: "Complete", completed_at: new Date().toISOString() }).eq("id", job.id);
    await service.from("crm_activities").insert({ lead_id: lead.id, rep_id: user.id, activity_type: "research_completed", description: `Re-research (${scope}) complete` });

    if (scope === "full") await computeAndSaveAudit(lead.id, user.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (job) await service.from("crm_research_jobs").update({ status: "failed", current_step: err instanceof Error ? err.message : "Research failed" }).eq("id", job.id);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Research failed." }, { status: 400 });
  }
}
