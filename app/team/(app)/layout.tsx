import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import TeamSidebar from "@/components/team/TeamSidebar";

export default async function TeamAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/team/login");

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, email, team_role")
    .eq("id", user.id)
    .single();

  if (!profile?.team_role) redirect("/team/login?error=not_authorized");

  return (
    <div className="min-h-screen flex" style={{ background: "#000000", color: "#F5F5F7" }}>
      <TeamSidebar
        name={profile.full_name || profile.email}
        role={profile.team_role}
      />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
