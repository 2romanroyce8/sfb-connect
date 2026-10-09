import { createSupabaseServerClient } from "@/lib/supabase/server";
import TaskBoard from "@/components/team/TaskBoard";
export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("users").select("team_role").eq("id", user!.id).single();
  return <TaskBoard isOwner={me?.team_role === "owner"} />;
}
