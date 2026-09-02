import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Loads the signed-in customer's business + latest project + latest score.
 * Assumes one business per owner for v1 (matches the onboarding flow, which
 * creates exactly one business per checkout).
 */
export async function getCurrentCustomerContext() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!business) return { user, business: null, project: null, score: null };

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("business_id", business.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let score = null;
  let findings: any[] = [];
  let recommendations: any[] = [];
  let report = null;
  let membership = null;

  if (project) {
    const { data: scoreRow } = await supabase
      .from("presence_scores")
      .select("*")
      .eq("project_id", project.id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    score = scoreRow;

    const { data: auditRows } = await supabase
      .from("audits")
      .select("id")
      .eq("project_id", project.id);

    if (auditRows && auditRows.length > 0) {
      const auditIds = auditRows.map((a) => a.id);
      const { data: findingRows } = await supabase
        .from("audit_findings")
        .select("*")
        .in("audit_id", auditIds)
        .order("created_at", { ascending: false });
      findings = findingRows || [];
    }

    const { data: recRows } = await supabase
      .from("recommendations")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false });
    recommendations = recRows || [];

    const { data: reportRow } = await supabase
      .from("reports")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    report = reportRow;
  }

  const { data: membershipRow } = await supabase
    .from("subscriptions_or_annual_memberships")
    .select("*")
    .eq("business_id", business.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  membership = membershipRow;

  return { user, business, project, score, findings, recommendations, report, membership };
}
