import { createSupabaseServerClient } from "@/lib/supabase/server";
import FollowUpsList from "@/components/team/FollowUpsList";

export default async function FollowUpsPage() {
  const supabase = createSupabaseServerClient();

  const { data: followups } = await supabase
    .from("crm_followups")
    .select("id, lead_id, due_at, reason, notes, status")
    .order("due_at", { ascending: true });

  const leadIds = Array.from(new Set((followups ?? []).map((f) => f.lead_id)));
  const { data: leads } = leadIds.length
    ? await supabase.from("crm_leads").select("id, business_name, phone").in("id", leadIds)
    : { data: [] as any[] };
  const leadMap = Object.fromEntries((leads ?? []).map((l) => [l.id, l]));

  return <FollowUpsList followups={followups ?? []} leadMap={leadMap} />;
}
