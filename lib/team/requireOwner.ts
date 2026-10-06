import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Owner-only guard for destructive team routes. The role is read from the
 * signed-in user's own row (RLS: users self-read) -- never from the request. */
export async function requireOwner() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  const { data: caller } = await supabase.from("users").select("team_role, team_status, email").eq("id", user.id).single();
  if (caller?.team_role !== "owner" || caller.team_status === "disabled") return { error: NextResponse.json({ error: "Owner access required." }, { status: 403 }) };
  return { supabase, userId: user.id, email: caller.email as string };
}
