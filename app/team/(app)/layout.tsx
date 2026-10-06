import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AGENT_SESSION_COOKIE } from "@/lib/agent/readOnly";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import TeamSidebar from "@/components/team/TeamSidebar";
import AccountWorkspaceMenu from "@/components/team/AccountWorkspaceMenu";

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
    .select("full_name, email, team_role, avatar_url")
    .eq("id", user.id)
    .single();

  if (!profile?.team_role) redirect("/team/login?error=not_authorized");

  const { data: activeSession } = await supabase
    .from("team_work_sessions")
    .select("id, clocked_in_at")
    .eq("rep_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  const isAgentSession = !!cookies().get(AGENT_SESSION_COOKIE);

  return (
    <div className="min-h-screen flex" style={{ background: "#000000", color: "#F5F5F7" }}>
      <TeamSidebar
        name={profile.full_name || profile.email}
        role={profile.team_role}
        avatarUrl={profile.avatar_url}
        activeSession={activeSession as { id: string; clocked_in_at: string } | null}
      />
      <div className="flex-1 min-w-0 relative">
        {isAgentSession && (
          <div className="w-full text-center text-[12px] py-1.5" style={{ background: "rgba(255,214,10,0.12)", color: "#FFD60A", borderBottom: "1px solid rgba(255,214,10,0.25)" }} role="status">
            Delegated agent session · read-only · acting as {profile.full_name || profile.email}. Writes are refused; revoke anytime in Settings → Connected Agents.
          </div>
        )}
        <AccountWorkspaceMenu
          name={profile.full_name || profile.email}
          email={profile.email}
          role={profile.team_role}
          avatarUrl={profile.avatar_url}
          activeSession={activeSession as { id: string; clocked_in_at: string } | null}
        />
        {children}
      </div>
    </div>
  );
}
