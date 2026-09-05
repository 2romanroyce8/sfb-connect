import { createSupabaseServerClient } from "@/lib/supabase/server";
import LeadImportForm from "@/components/team/LeadImportForm";

export default async function LeadImportPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user!.id).single();

  // Reps only ever assign leads to themselves; the owner can hand a lead to
  // anyone on the roster.
  let reps: { id: string; label: string }[] = [];
  if (caller?.team_role === "owner") {
    const { data: members } = await supabase
      .from("users")
      .select("id, first_name, last_name, full_name, email")
      .not("team_role", "is", null)
      .eq("team_status", "active");
    reps = (members ?? []).map((m) => ({
      id: m.id,
      label: m.full_name || [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email,
    }));
  } else {
    reps = [{ id: user!.id, label: "Me" }];
  }

  return (
    <div className="px-8 py-8">
      <LeadImportForm reps={reps} />
    </div>
  );
}
