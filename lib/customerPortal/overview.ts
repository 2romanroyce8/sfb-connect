import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PresenceScoreSnapshot = {
  id: string;
  overall_score: number;
  identity_score: number | null;
  knowledge_score: number | null;
  authority_score: number | null;
  location_score: number | null;
  machine_readability_score: number | null;
  methodology_version: string;
  recorded_at: string;
};

export type PresenceSummary =
  | { status: "no_data" }
  | { status: "single"; current: PresenceScoreSnapshot }
  | { status: "trend"; current: PresenceScoreSnapshot; baseline: PresenceScoreSnapshot; changePoints: number }
  | { status: "incomparable"; current: PresenceScoreSnapshot; baseline: PresenceScoreSnapshot };

/**
 * Resolves the customer's current AI Presence score and, where a
 * comparable earlier measurement exists, the change since baseline.
 *
 * "Comparable" means SAME methodology_version -- a score computed under a
 * different scoring methodology is never diffed against the current one,
 * because the delta would not mean what it appears to mean. When that
 * happens this returns "incomparable" rather than a misleading number.
 *
 * Change is always expressed in POINTS (current.overall_score -
 * baseline.overall_score), never "+N%" -- overall_score is a 0-100 score,
 * not a percentage rate, so a 14-point move is "+14 points," not "+14%".
 */
export async function getPresenceSummary(businessId: string): Promise<PresenceSummary> {
  const supabase = createSupabaseServerClient();
  const { data: scores } = await supabase
    .from("presence_scores")
    .select("id, overall_score, identity_score, knowledge_score, authority_score, location_score, machine_readability_score, methodology_version, recorded_at")
    .eq("business_id", businessId)
    .order("recorded_at", { ascending: false });

  if (!scores || scores.length === 0) return { status: "no_data" };

  const current = scores[0] as PresenceScoreSnapshot;
  if (scores.length === 1) return { status: "single", current };

  // Baseline = earliest recorded score under the SAME methodology version
  // as the current one (walking from the oldest end of the same list).
  const sameMethodology = scores.filter((s) => s.methodology_version === current.methodology_version);
  const baseline = sameMethodology[sameMethodology.length - 1] as PresenceScoreSnapshot;

  if (!baseline || baseline.id === current.id) {
    // Current score's methodology has no earlier comparable measurement --
    // there IS an older row, just under a different methodology.
    const anyBaseline = scores[scores.length - 1] as PresenceScoreSnapshot;
    return { status: "incomparable", current, baseline: anyBaseline };
  }

  return { status: "trend", current, baseline, changePoints: current.overall_score - baseline.overall_score };
}

export type RecentFinding = {
  id: string;
  finding: string;
  severity: "info" | "minor" | "moderate" | "critical";
  category: string | null;
  resolved: boolean;
  created_at: string;
};

export async function getRecentFindings(businessId: string, limit = 5): Promise<RecentFinding[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("audit_findings")
    .select("id, finding, severity, resolved, created_at, audit_categories(name)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((f: any) => ({
    id: f.id,
    finding: f.finding,
    severity: f.severity,
    category: f.audit_categories?.name ?? null,
    resolved: f.resolved,
    created_at: f.created_at,
  }));
}

export type ActivityItem = {
  id: string;
  source:
    | "scan_status"
    | "finding"
    | "recommendation"
    | "report"
    | "addon_purchase"
    | "credit_transaction"
    | "provisioning";
  title: string;
  detail: string | null;
  timestamp: string;
  status: "Completed" | "Running" | "Waiting" | "Needs You";
};

/**
 * Real activity read-model. There is no single unified "activity_log"
 * table yet, so this aggregates from every table that already represents
 * a real thing SFB did, tags each row with exactly where it came from (see
 * `source`), and merges by timestamp. Nothing here is synthesized --
 * an empty section per source just contributes nothing to the merged list.
 *
 * Sources, and what each becomes:
 * - project_status_history  -> scan run status changes (queued/running/completed/failed)
 * - audit_findings          -> "New finding discovered"
 * - recommendations         -> "New recommendation"
 * - reports                 -> "Report published" (only when published_at is set)
 * - addon_purchases         -> "Add-on purchased" / status
 * - credit_transactions     -> "Credits purchased" / "Credits used" (positive vs negative amount)
 * - billing_audit_log       -> "Account provisioned" (customer_provisioned action)
 */
export async function getRecentActivity(businessId: string, limit = 12): Promise<ActivityItem[]> {
  const supabase = createSupabaseServerClient();

  const [scanHistory, findings, recommendations, reports, addonPurchases, creditTxns, billingLog] = await Promise.all([
    supabase
      .from("project_status_history")
      .select("id, status, note, created_at, project_id, projects!inner(business_id, scan_type)")
      .eq("projects.business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("audit_findings")
      .select("id, finding, severity, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("recommendations")
      .select("id, title, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("reports")
      .select("id, summary, report_type, published_at")
      .eq("business_id", businessId)
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(limit),
    supabase
      .from("addon_purchases")
      .select("id, purchase_type, status, created_at, addon_products(name), credit_packages(name)")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("credit_transactions")
      .select("id, amount, description, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("billing_audit_log")
      .select("id, action, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  const items: ActivityItem[] = [];

  for (const h of scanHistory.data ?? []) {
    const scanType = (h as any).projects?.scan_type ?? "scan";
    items.push({
      id: `scan-${h.id}`,
      source: "scan_status",
      title:
        h.status === "completed"
          ? `${scanType.replace(/_/g, " ")} completed`
          : h.status === "failed"
            ? `${scanType.replace(/_/g, " ")} failed`
            : h.status === "running"
              ? `${scanType.replace(/_/g, " ")} running`
              : `${scanType.replace(/_/g, " ")} queued`,
      detail: h.note,
      timestamp: h.created_at,
      status: h.status === "completed" ? "Completed" : h.status === "failed" ? "Needs You" : h.status === "running" ? "Running" : "Waiting",
    });
  }

  for (const f of findings.data ?? []) {
    items.push({
      id: `finding-${f.id}`,
      source: "finding",
      title: "New finding discovered",
      detail: f.finding,
      timestamp: f.created_at,
      status: "Completed",
    });
  }

  for (const r of recommendations.data ?? []) {
    items.push({
      id: `rec-${r.id}`,
      source: "recommendation",
      title: "New recommendation",
      detail: r.title,
      timestamp: r.created_at,
      status: "Needs You",
    });
  }

  for (const rep of reports.data ?? []) {
    items.push({
      id: `report-${rep.id}`,
      source: "report",
      title: `${rep.report_type ? rep.report_type.replace(/_/g, " ") + " report" : "Report"} published`,
      detail: rep.summary,
      timestamp: rep.published_at as string,
      status: "Completed",
    });
  }

  for (const p of addonPurchases.data ?? []) {
    const name = (p as any).addon_products?.name ?? (p as any).credit_packages?.name ?? "add-on";
    items.push({
      id: `purchase-${p.id}`,
      source: "addon_purchase",
      title: p.purchase_type === "credits" ? `Purchased ${name}` : `Added ${name}`,
      detail: `Status: ${p.status}`,
      timestamp: p.created_at,
      status: p.status === "completed" ? "Completed" : p.status === "failed" ? "Needs You" : "Waiting",
    });
  }

  for (const c of creditTxns.data ?? []) {
    items.push({
      id: `credit-${c.id}`,
      source: "credit_transaction",
      title: c.amount > 0 ? `Credits purchased (+${c.amount})` : `Credits used (${c.amount})`,
      detail: c.description,
      timestamp: c.created_at,
      status: "Completed",
    });
  }

  for (const b of billingLog.data ?? []) {
    if (b.action !== "customer_provisioned") continue;
    items.push({
      id: `provision-${b.id}`,
      source: "provisioning",
      title: "SFB Connect account activated",
      detail: null,
      timestamp: b.created_at,
      status: "Completed",
    });
  }

  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit);
}

export type OnboardingStage = { key: string; label: string; state: "complete" | "running" | "queued" };

/**
 * Real, stage-based new-customer checklist -- every stage is derived from
 * actual stored state, never a fabricated percentage.
 */
export async function getOnboardingStages(businessId: string): Promise<OnboardingStage[]> {
  const supabase = createSupabaseServerClient();

  const [{ data: business }, { data: locations }, { data: competitorRows }, { data: latestProject }, { data: scoreRows }] = await Promise.all([
    supabase.from("businesses").select("legal_name, website, primary_category").eq("id", businessId).maybeSingle(),
    supabase.from("business_locations").select("id").eq("business_id", businessId).limit(1),
    supabase.from("competitors").select("id").eq("business_id", businessId).limit(1),
    supabase.from("projects").select("status").eq("business_id", businessId).order("started_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("presence_scores").select("id").eq("business_id", businessId).limit(1),
  ]);

  const businessInfoComplete = Boolean(business?.legal_name && business?.website);
  const locationEstablished = Boolean(locations && locations.length > 0);
  const competitorsEstablished = Boolean(competitorRows && competitorRows.length > 0);
  const scanRunning = latestProject?.status === "running";
  const scanComplete = latestProject?.status === "completed";
  const hasScore = Boolean(scoreRows && scoreRows.length > 0);

  return [
    { key: "business_connected", label: "Business connected", state: "complete" },
    { key: "business_verified", label: "Business information verified", state: businessInfoComplete ? "complete" : "queued" },
    {
      key: "research_started",
      label: "Research started",
      state: scanComplete || scanRunning ? "complete" : latestProject ? "running" : "queued",
    },
    { key: "ai_visibility_analyzed", label: "AI visibility analyzed", state: hasScore ? "complete" : scanRunning ? "running" : "queued" },
    { key: "competitors_established", label: "Competitors established", state: competitorsEstablished ? "complete" : "queued" },
    { key: "initial_report", label: "Initial report prepared", state: scanComplete ? "complete" : "queued" },
  ];
}
