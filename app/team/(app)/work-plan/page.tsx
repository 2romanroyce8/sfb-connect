import { createSupabaseServerClient } from "@/lib/supabase/server";
import WorkPlanList from "@/components/team/WorkPlanList";

export default async function WorkPlanIndexPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user!.id).single();
  const isOwner = caller?.team_role === "owner";

  // RLS: owner sees every plan; a rep only sees plans containing an item
  // assigned to them.
  const { data: plans } = await supabase
    .from("crm_work_plans")
    .select("id, name, plan_type, start_date, end_date, status, related_lead_id")
    .order("start_date", { ascending: false });

  const planIds = (plans ?? []).map((p) => p.id);
  const { data: items } = planIds.length ? await supabase.from("crm_work_plan_items").select("work_plan_id, status").in("work_plan_id", planIds) : { data: [] as any[] };

  const progressByPlan: Record<string, { total: number; complete: number }> = {};
  for (const i of items ?? []) {
    if (!progressByPlan[i.work_plan_id]) progressByPlan[i.work_plan_id] = { total: 0, complete: 0 };
    progressByPlan[i.work_plan_id].total++;
    if (i.status === "complete") progressByPlan[i.work_plan_id].complete++;
  }

  return <WorkPlanList plans={plans ?? []} progressByPlan={progressByPlan} isOwner={isOwner} />;
}
