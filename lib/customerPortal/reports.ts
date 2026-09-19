import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ReportListItem = {
  id: string;
  reportType: string | null;
  summary: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  publishedAt: string | null;
  fileUrl: string | null;
  projectId: string | null;
};

export async function getReports(businessId: string): Promise<ReportListItem[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("reports")
    .select("id, report_type, summary, period_start, period_end, published_at, file_url, project_id")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id,
    reportType: r.report_type,
    summary: r.summary,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    publishedAt: r.published_at,
    fileUrl: r.file_url,
    projectId: r.project_id,
  }));
}

export type ReportDetail = ReportListItem & {
  findings: { id: string; finding: string; severity: string; resolved: boolean }[];
  recommendations: { id: string; title: string; status: string }[];
  presenceScore: { overall_score: number; recorded_at: string } | null;
};

/**
 * A report is a real generated artifact (a `reports` row), but its
 * "Presence / Findings / Recommendations" sections in the viewer are
 * populated from the same underlying business intelligence at that
 * report's scan run (project_id) -- not duplicated/copied data, and never
 * a section rendered empty-but-present when nothing exists (the UI omits
 * empty sections entirely).
 */
export async function getReportDetail(businessId: string, reportId: string): Promise<ReportDetail | null> {
  const supabase = createSupabaseServerClient();
  const { data: report } = await supabase
    .from("reports")
    .select("id, report_type, summary, period_start, period_end, published_at, file_url, project_id")
    .eq("id", reportId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (!report) return null;

  const [{ data: findings }, { data: recommendations }, { data: score }] = await Promise.all([
    report.project_id
      ? supabase.from("audit_findings").select("id, finding, severity, resolved").eq("project_id", report.project_id).limit(20)
      : Promise.resolve({ data: [] }),
    report.project_id
      ? supabase.from("recommendations").select("id, title, status").eq("project_id", report.project_id).limit(20)
      : Promise.resolve({ data: [] }),
    report.project_id
      ? supabase.from("presence_scores").select("overall_score, recorded_at").eq("project_id", report.project_id).order("recorded_at", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    id: report.id,
    reportType: report.report_type,
    summary: report.summary,
    periodStart: report.period_start,
    periodEnd: report.period_end,
    publishedAt: report.published_at,
    fileUrl: report.file_url,
    projectId: report.project_id,
    findings: findings ?? [],
    recommendations: recommendations ?? [],
    presenceScore: score ?? null,
  };
}
