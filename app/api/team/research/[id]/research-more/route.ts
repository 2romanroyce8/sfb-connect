import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildLeadProfile } from "@/lib/research/LeadProfileBuilder";
import { evaluateCompleteness } from "@/lib/research/CompletenessEvaluator";
import type { BusinessGraph } from "@/lib/research/types";

// "Research More" re-runs discovery with the original sources plus any
// additional ones the rep adds, and merges into the SAME staged result
// rather than creating a duplicate research entry.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: result } = await supabase.from("crm_research_results").select("*").eq("id", params.id).single();
  if (!result) return NextResponse.json({ error: "Research result not found or not accessible." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const additionalSources: string[] = (body.additionalSources || []).filter((s: string) => s && s.trim());
  const allSources = Array.from(new Set([...(result.source_urls as string[]), ...additionalSources]));

  try {
    const { graph } = await buildLeadProfile(allSources);
    const completeness = evaluateCompleteness(graph);
    const website = graph.contactMethods.find((c) => c.type === "website");
    const phone = graph.contactMethods.find((c) => c.type === "phone");
    const email = graph.contactMethods.find((c) => c.type === "email");

    const { error } = await supabase
      .from("crm_research_results")
      .update({
        source_urls: allSources,
        business_name: graph.businessName?.value || result.business_name,
        website: website?.value || result.website,
        phone: phone?.value || result.phone,
        email: email?.value || result.email,
        category: graph.category || result.category,
        description: graph.description || result.description,
        services: graph.services.length > 0 ? graph.services : result.services,
        owner_name: graph.ownerName || result.owner_name,
        research_completeness: completeness.overallPercent,
        research_completeness_breakdown: completeness.breakdown,
        graph_json: graph as unknown as BusinessGraph,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ completeness: completeness.overallPercent });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Research failed." }, { status: 400 });
  }
}
