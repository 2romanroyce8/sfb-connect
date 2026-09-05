import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { generateOpportunity, type OpportunityResult } from "./opportunity";

// ============================================================
// scoreAudit() — deterministic, explainable AI Presence scoring.
//
// This function NEVER invents a number. Every point awarded traces back to
// a specific crm_lead_evidence row written during the research pipeline
// (Phase 5-7). If the evidence isn't there, the category loses points and
// says so — it does not guess. An LLM is never involved in the scoring
// itself; generateBusinessSummary() below is the only place free text is
// composed, and it is templated from these same category objects, not from
// a model call.
// ============================================================

export type EvidenceRow = {
  field_name: string;
  field_value: string | null;
  status: "verified" | "uncertain" | "not_found" | "conflict";
  source_url: string | null;
};

export type CategoryResult = {
  category: "identity" | "knowledge" | "authority" | "location" | "machine_readability";
  score: number;
  reason: string;
  positive_evidence: string[];
  negative_evidence: string[];
  unknowns: string[];
  recommended_fixes: string[];
};

export type AuditResult = {
  overall: number;
  categories: CategoryResult[];
};

function latestByField(evidence: EvidenceRow[]) {
  const map: Record<string, EvidenceRow> = {};
  for (const e of evidence) {
    // evidence is queried newest-first, so the first hit per field wins
    if (!map[e.field_name]) map[e.field_name] = e;
  }
  return map;
}

export function scoreAudit(evidence: EvidenceRow[]): AuditResult {
  const f = latestByField(evidence);
  const categories: CategoryResult[] = [];

  // ---- Identity (0-20) ----
  {
    const name = f["business_name"];
    let score = 0;
    const positive: string[] = [];
    const negative: string[] = [];
    const unknowns: string[] = [];
    const fixes: string[] = [];
    if (name?.status === "verified") {
      score = 20;
      positive.push(`Business name "${name.field_value}" is confirmed across sources`);
    } else if (name?.status === "uncertain") {
      score = 10;
      positive.push(`Business name "${name.field_value}" was found, but only from a single source`);
      fixes.push("Make sure the business name is identical across your website title, Google Business Profile, and social pages");
    } else if (name?.status === "conflict") {
      score = 5;
      negative.push("Different sources list different names for this business");
      fixes.push("Standardize the business name everywhere it appears online");
    } else {
      score = 0;
      unknowns.push("Could not confirm a business name from any supplied source");
      fixes.push("Publish a clear, consistent business name on the website's homepage and title tag");
    }
    categories.push({
      category: "identity",
      score,
      reason: name?.status === "verified" ? "Name confirmed by multiple independent sources" : "Name could not be fully confirmed",
      positive_evidence: positive,
      negative_evidence: negative,
      unknowns,
      recommended_fixes: fixes,
    });
  }

  // ---- Knowledge (0-20) ----
  {
    const meta = f["meta_description"];
    const schema = f["structured_data"];
    let score = 0;
    const positive: string[] = [];
    const negative: string[] = [];
    const unknowns: string[] = [];
    const fixes: string[] = [];
    if (meta?.status === "verified") {
      score += 10;
      positive.push("Website has a meta description summarizing the business");
    } else {
      negative.push("No meta description found on the website");
      fixes.push("Add a meta description that clearly states what the business does and where it operates");
    }
    if (schema?.status === "verified") {
      score += 10;
      positive.push("Website publishes structured business data (schema.org)");
    } else {
      negative.push("No structured business data (schema.org) found");
      fixes.push("Add LocalBusiness/Organization schema markup describing services, hours, and location");
    }
    categories.push({
      category: "knowledge",
      score,
      reason: score >= 15 ? "Business information is machine-parseable" : "Key business information is missing or not machine-parseable",
      positive_evidence: positive,
      negative_evidence: negative,
      unknowns,
      recommended_fixes: fixes,
    });
  }

  // ---- Authority (0-20) ----
  {
    const social = f["social_profiles"];
    const rating = f["aggregate_rating"];
    let score = 0;
    const positive: string[] = [];
    const negative: string[] = [];
    const unknowns: string[] = [];
    const fixes: string[] = [];
    if (social?.status === "verified" && social.field_value && social.field_value !== "none") {
      score += 10;
      positive.push(`Linked to social profiles: ${social.field_value}`);
    } else {
      negative.push("No linked social profiles found on the website");
      fixes.push("Link active social profiles from the website so AI systems can cross-reference the business");
    }
    if (rating?.status === "verified") {
      score += 10;
      positive.push("Review/rating data found in structured data");
    } else {
      unknowns.push("Could not confirm whether the business has published review data");
      fixes.push("Collect and display customer reviews with review schema markup");
    }
    categories.push({
      category: "authority",
      score,
      reason: score >= 15 ? "Business has external signals reinforcing its credibility" : "Limited external signals reinforcing credibility",
      positive_evidence: positive,
      negative_evidence: negative,
      unknowns,
      recommended_fixes: fixes,
    });
  }

  // ---- Location (0-20) ----
  {
    const location = f["location"];
    let score = 0;
    const positive: string[] = [];
    const negative: string[] = [];
    const unknowns: string[] = [];
    const fixes: string[] = [];
    if (location?.status === "verified") {
      score = 20;
      positive.push(`Location confirmed: ${location.field_value}`);
    } else if (location?.status === "uncertain") {
      score = 10;
      positive.push(`Location found (${location.field_value}) but only from one source`);
      fixes.push("Add a consistent, structured address (NAP) across the website and Google Business Profile");
    } else {
      unknowns.push("Could not confirm a service area or address from any supplied source");
      fixes.push("Publish a clear address or service area on the website with matching structured data");
    }
    categories.push({
      category: "location",
      score,
      reason: score >= 15 ? "Geographic information is clear and consistent" : "Geographic information is unclear or unconfirmed",
      positive_evidence: positive,
      negative_evidence: negative,
      unknowns,
      recommended_fixes: fixes,
    });
  }

  // ---- Machine Readability (0-20) ----
  {
    const https = f["https"];
    const schema = f["structured_data"];
    let score = 0;
    const positive: string[] = [];
    const negative: string[] = [];
    const unknowns: string[] = [];
    const fixes: string[] = [];
    if (https?.status === "verified") {
      score += 10;
      positive.push("Website is served over HTTPS");
    } else {
      negative.push("Website is not confirmed to be served over HTTPS");
      fixes.push("Serve the website over HTTPS with a valid SSL certificate");
    }
    if (schema?.status === "verified") {
      score += 10;
      positive.push("Structured data gives AI systems a machine-readable summary of the business");
    } else {
      negative.push("No structured data for AI systems to parse");
      fixes.push("Add schema.org markup so AI systems can read business details directly, not just guess from prose");
    }
    categories.push({
      category: "machine_readability",
      score,
      reason: score >= 15 ? "AI systems can reliably parse this business's data" : "AI systems will struggle to reliably parse this business's data",
      positive_evidence: positive,
      negative_evidence: negative,
      unknowns,
      recommended_fixes: fixes,
    });
  }

  const overall = categories.reduce((sum, c) => sum + c.score, 0);
  return { overall, categories };
}

export async function computeAndSaveAudit(leadId: string, actorId: string) {
  const service = createSupabaseServiceClient();

  const { data: evidence } = await service
    .from("crm_lead_evidence")
    .select("field_name, field_value, status, source_url")
    .eq("lead_id", leadId)
    .order("discovered_at", { ascending: false });

  if (!evidence || evidence.length === 0) {
    throw new Error("No research evidence found for this lead yet. Run the research pipeline first.");
  }

  const result = scoreAudit(evidence as EvidenceRow[]);

  const strengths = result.categories.flatMap((c) => c.positive_evidence);
  const weaknesses = result.categories.flatMap((c) => c.negative_evidence);
  const unknowns = result.categories.flatMap((c) => c.unknowns);
  const middlePoints = result.categories
    .filter((c) => c.score > 0 && c.score < 15)
    .map((c) => `${c.category.replace(/_/g, " ")} is partially in place but incomplete`);

  const byCat = Object.fromEntries(result.categories.map((c) => [c.category, c.score]));

  const { data: audit, error } = await service
    .from("crm_audits")
    .insert({
      lead_id: leadId,
      overall_score: result.overall,
      identity_score: byCat["identity"],
      knowledge_score: byCat["knowledge"],
      authority_score: byCat["authority"],
      location_score: byCat["location"],
      machine_readability_score: byCat["machine_readability"],
      summary: null,
      strengths,
      middle_points: middlePoints,
      weaknesses,
      unknowns,
    })
    .select("id")
    .single();

  if (error || !audit) throw new Error(error?.message || "Could not save audit.");

  for (const c of result.categories) {
    await service.from("crm_audit_categories").insert({
      audit_id: audit.id,
      category: c.category,
      score: c.score,
      reason: c.reason,
      positive_evidence: c.positive_evidence,
      negative_evidence: c.negative_evidence,
      unknowns: c.unknowns,
      recommended_fixes: c.recommended_fixes,
    });
  }

  await service
    .from("crm_leads")
    .update({ ai_overall_score: result.overall, updated_at: new Date().toISOString() })
    .eq("id", leadId);

  await service.from("crm_activities").insert({
    lead_id: leadId,
    rep_id: actorId,
    activity_type: "audit_completed",
    description: `AI Presence Audit completed — ${result.overall}/100`,
  });

  // ---- Opportunity — derived from the same category results, no re-research ----
  const { data: lead } = await service.from("crm_leads").select("website").eq("id", leadId).single();
  const opportunity: OpportunityResult = generateOpportunity(result.categories, !!lead?.website);

  await service.from("crm_opportunities").insert({
    lead_id: leadId,
    primary_offer: opportunity.primary,
    secondary_offer: opportunity.secondary,
    confidence: opportunity.confidence,
    reasoning: opportunity.why.join(" "),
  });

  await service
    .from("crm_leads")
    .update({ recommended_offer: opportunity.primary, updated_at: new Date().toISOString() })
    .eq("id", leadId);

  await service.from("crm_activities").insert({
    lead_id: leadId,
    rep_id: actorId,
    activity_type: "opportunity_generated",
    description: `Recommended offer: ${opportunity.primary.replace(/_/g, " ")} (${opportunity.confidence} confidence)`,
  });

  return { auditId: audit.id, ...result, opportunity };
}
