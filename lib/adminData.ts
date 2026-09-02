import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function listProjectsForAdmin() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("projects")
    .select(
      `id, status, started_at, target_completion_at, completed_at,
       businesses ( id, legal_name, primary_category, owner_id, website )`
    )
    .order("started_at", { ascending: false });

  return data || [];
}

export async function getProjectForAdmin(projectId: string) {
  const supabase = createSupabaseServerClient();

  const { data: project } = await supabase
    .from("projects")
    .select(
      `*, businesses ( *, business_locations(*), business_services(*), business_social_profiles(*), competitors(*) )`
    )
    .eq("id", projectId)
    .single();

  if (!project) return null;

  const { data: scores } = await supabase
    .from("presence_scores")
    .select("*")
    .eq("project_id", projectId)
    .order("recorded_at", { ascending: false });

  const { data: audits } = await supabase
    .from("audits")
    .select("*, audit_findings(*, audit_categories(name))")
    .eq("project_id", projectId)
    .order("started_at", { ascending: false });

  const { data: recommendations } = await supabase
    .from("recommendations")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const { data: statusHistory } = await supabase
    .from("project_status_history")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const { data: notes } = await supabase
    .from("admin_notes")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const { data: reports } = await supabase
    .from("reports")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return { project, scores: scores || [], audits: audits || [], recommendations: recommendations || [], statusHistory: statusHistory || [], notes: notes || [], reports: reports || [] };
}
