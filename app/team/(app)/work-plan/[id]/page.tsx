import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import WorkPlanGantt from "@/components/team/WorkPlanGantt";

export default async function WorkPlanDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user!.id).single();
  const isOwner = caller?.team_role === "owner";

  const { data: plan } = await supabase.from("crm_work_plans").select("*").eq("id", params.id).single();
  if (!plan) notFound();

  const [{ data: items }, { data: milestones }, { data: reps }] = await Promise.all([
    supabase.from("crm_work_plan_items").select("*").eq("work_plan_id", params.id).order("row_index", { ascending: true }),
    supabase.from("crm_work_plan_milestones").select("*").eq("work_plan_id", params.id).order("date", { ascending: true }),
    isOwner ? supabase.from("users").select("id, full_name, email").not("team_role", "is", null) : Promise.resolve({ data: [] as any[] }),
  ]);

  return (
    <WorkPlanGantt
      plan={plan as any}
      items={(items ?? []) as any}
      milestones={(milestones ?? []) as any}
      isOwner={isOwner}
      reps={(reps ?? []).map((r) => ({ id: r.id, label: r.full_name || r.email }))}
    />
  );
}
