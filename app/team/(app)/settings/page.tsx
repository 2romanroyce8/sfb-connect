import { createSupabaseServerClient } from "@/lib/supabase/server";
import SettingsPanel from "@/components/team/SettingsPanel";

export default async function TeamSettingsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, email, team_role, team_status, created_at")
    .eq("id", user!.id)
    .single();

  return <SettingsPanel profile={profile as any} />;
}
