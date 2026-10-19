import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ContentLab from "@/components/team/ContentLab";
export const dynamic = "force-dynamic";

/** Content Lab — Rome's content autopilot (owner only). Phase 1: Trend Radar + Pattern Analyzer. */
export default async function ContentLabPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("users").select("team_role").eq("id", user!.id).single();
  if (me?.team_role !== "owner") redirect("/team/dashboard");
  return <ContentLab />;
}
