import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import PortfolioAdmin from "@/components/team/PortfolioAdmin";

export default async function TeamPortfolioPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user!.id).single();
  if (caller?.team_role !== "owner") redirect("/team/dashboard");

  const { data: projects } = await supabase.from("portfolio_projects").select("*").order("sort_order", { ascending: true });
  const projectIds = (projects ?? []).map((p) => p.id);

  const [{ data: services }, { data: media }] = await Promise.all([
    projectIds.length ? supabase.from("portfolio_services").select("*").in("project_id", projectIds) : Promise.resolve({ data: [] as any[] }),
    projectIds.length ? supabase.from("portfolio_media").select("*").in("project_id", projectIds) : Promise.resolve({ data: [] as any[] }),
  ]);

  return <PortfolioAdmin initialProjects={projects ?? []} initialServices={services ?? []} initialMedia={media ?? []} />;
}
