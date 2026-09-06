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
    .select("id, business_name, website, phone, category, pipeline_stage, recommended_offer, ai_overall_score, assigned_rep, updated_at")
    .eq("archived", false)
    .order("updated_at", { ascending: false });

  let repNames: Record<string, string> = {};
  if (isOwner) {
    const { data: reps } = await supabase.from("users").select("id, full_name, email").not("team_role", "is", null);
    repNames = Object.fromEntries((reps ?? []).map((r) => [r.id, r.full_name || r.email]));
  }

  const leadIds = (leads ?? []).map((l) => l.id);
  const [{ data: notes }, { data: sourceChecks }] = await Promise.all([
    leadIds.length ? supabase.from("crm_notes").select("lead_id").in("lead_id", leadIds) : Promise.resolve({ data: [] as any[] }),
    leadIds.length ? supabase.from("crm_lead_source_checks").select("lead_id").in("lead_id", leadIds) : Promise.resolve({ data: [] as any[] }),
  ]);

  const noteCounts: Record<string, number> = {};
  for (const n of notes ?? []) noteCounts[n.lead_id] = (noteCounts[n.lead_id] || 0) + 1;
  const sourceCounts: Record<string, number> = {};
  for (const s of sourceChecks ?? []) sourceCounts[s.lead_id] = (sourceCounts[s.lead_id] || 0) + 1;

  return <PipelineBoard leads={leads ?? []} repNames={repNames} isOwner={isOwner} noteCounts={noteCounts} sourceCounts={sourceCounts} />;
}
