import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ResearchResultView from "@/components/team/ResearchResultView";

export default async function ResearchResultPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: result } = await supabase.from("crm_research_results").select("*").eq("id", params.id).single();
  if (!result) notFound();

  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user!.id).single();
  const isOwner = caller?.team_role === "owner";

  let reps: { id: string; label: string }[] = [];
  if (isOwner) {
    const { data: members } = await supabase.from("users").select("id, full_name, email").not("team_role", "is", null).eq("team_status", "active");
    reps = (members ?? []).map((m) => ({ id: m.id, label: m.full_name || m.email }));
  } else {
    reps = [{ id: user!.id, label: "Me" }];
  }

  return <ResearchResultView result={result as any} reps={reps} />;
}
