import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import TeamRoster from "@/components/team/TeamRoster";

export default async function TeamManagementPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: caller } = await supabase
    .from("users")
    .select("team_role")
    .eq("id", user!.id)
    .single();

  if (caller?.team_role !== "owner") redirect("/team/dashboard");

  const { data: members } = await supabase
    .from("users")
    .select(
      "id, first_name, last_name, full_name, email, team_role, team_status, invited_at, activated_at, last_active_at"
    )
    .not("team_role", "is", null)
    .order("invited_at", { ascending: true });

  return <TeamRoster members={members ?? []} />;
}
