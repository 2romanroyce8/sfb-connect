import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function TeamRootPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/team/login");

  const { data: profile } = await supabase
    .from("users")
    .select("team_role")
    .eq("id", user.id)
    .single();

  if (!profile?.team_role) redirect("/team/login?error=not_authorized");

  redirect("/team/dashboard");
}
