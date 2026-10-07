import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import SettingsPanel from "@/components/team/SettingsPanel";

export default async function TeamSettingsPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, email, team_role, team_status, created_at, avatar_url, home_timezone")
    .eq("id", user!.id)
    .single();

  // Real integration state for the defaults section -- never a stale "not
  // connected" sentence that contradicts the Integrations page.
  // crm_calendar_connections holds OAuth tokens, so it has no user-facing
  // read policy; read ONLY the two non-secret columns for the signed-in user
  // through the service client (same approach as the Integrations page).
  const { data: cal } = await createSupabaseServiceClient().from("crm_calendar_connections").select("google_email, refresh_failed_at").eq("rep_id", user!.id).maybeSingle();
  const aiProviderConfigured = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY);
  return <SettingsPanel profile={profile as any} integrations={{ calendarEmail: cal && !cal.refresh_failed_at ? cal.google_email : null, aiProviderConfigured }} />;
}
