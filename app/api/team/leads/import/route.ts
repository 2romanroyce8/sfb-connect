import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { buildLeadProfile } from "@/lib/research/LeadProfileBuilder";
import { evaluateCompleteness } from "@/lib/research/CompletenessEvaluator";

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
  if (rawSources.length === 0) return NextResponse.json({ error: "At least one source URL is required." }, { status: 400 });

  const service = createSupabaseServiceClient();

  try {
    const { graph } = await buildLeadProfile(rawSources);
    const completeness = evaluateCompleteness(graph);
    const website = graph.contactMethods.find((c) => c.type === "website");
    const phone = graph.contactMethods.find((c) => c.type === "phone");
    const email = graph.contactMethods.find((c) => c.type === "email");

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
    if (error || !result) return NextResponse.json({ error: error?.message || "Could not save research result." }, { status: 400 });

    return NextResponse.json({ researchResultId: result.id, completeness: completeness.overallPercent });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Research failed." }, { status: 400 });
  }
}
