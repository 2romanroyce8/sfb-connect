import { createSupabaseServerClient } from "@/lib/supabase/server";
/** Team members only (owner or employee). Clients have no team_role → null. */
export async function teamCaller() {
  const supabase = createSupabaseServerClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return null;
  const { data: me } = await supabase.from("users").select("id, full_name, email, team_role").eq("id", user.id).single();
  return me?.team_role ? (me as { id: string; full_name: string | null; email: string; team_role: string }) : null;
}
export const SETUP_MSG = "Database setup pending: apply supabase/migrations/20261019_board_room_campaigns.sql.";
export const missingTable = (e: { code?: string; message?: string } | null) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message ?? ""));
