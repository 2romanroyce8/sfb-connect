import { createSupabaseServerClient } from "@/lib/supabase/server";
import PipelineBoard from "@/components/team/PipelineBoard";

export default async function PipelinePage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user!.id).single();
  const isOwner = caller?.team_role === "owner";

  // RLS scopes this to assigned leads for a rep, all leads for the owner —
  // the board never fetches more than the viewer is allowed to see.
  const { data: leads } = await supabase
    .from("crm_leads")
    .select("id, business_name, website, phone, pipeline_stage, recommended_offer, ai_overall_score, assigned_rep, updated_at")
    .order("updated_at", { ascending: false });

  let repNames: Record<string, string> = {};
  if (isOwner) {
    const { data: reps } = await supabase.from("users").select("id, full_name, email").not("team_role", "is", null);
    repNames = Object.fromEntries((reps ?? []).map((r) => [r.id, r.full_name || r.email]));
  }

  return <PipelineBoard leads={leads ?? []} repNames={repNames} isOwner={isOwner} />;
}
