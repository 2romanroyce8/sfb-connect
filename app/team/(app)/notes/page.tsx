import { createSupabaseServerClient } from "@/lib/supabase/server";
import NotesBoard from "@/components/team/NotesBoard";

export default async function NotesPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user!.id).single();
  const isOwner = caller?.team_role === "owner";

  const { data: notes } = await supabase
    .from("crm_notes")
    .select("id, lead_id, author_id, note_type, note, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const leadIds = Array.from(new Set((notes ?? []).map((n) => n.lead_id)));
  const authorIds = Array.from(new Set((notes ?? []).map((n) => n.author_id).filter(Boolean)));

  const [{ data: leads }, { data: authors }, { data: myLeads }] = await Promise.all([
    leadIds.length ? supabase.from("crm_leads").select("id, business_name").in("id", leadIds) : Promise.resolve({ data: [] as any[] }),
    authorIds.length ? supabase.from("users").select("id, full_name, email").in("id", authorIds) : Promise.resolve({ data: [] as any[] }),
    supabase.from("crm_leads").select("id, business_name").order("business_name", { ascending: true }).limit(200),
  ]);

  const leadMap = Object.fromEntries((leads ?? []).map((l) => [l.id, l.business_name]));
  const authorMap = Object.fromEntries((authors ?? []).map((a) => [a.id, a.full_name || a.email]));

  return (
    <NotesBoard
      notes={notes ?? []}
      leadMap={leadMap}
      authorMap={authorMap}
      isOwner={isOwner}
      myLeads={(myLeads ?? []).map((l) => ({ id: l.id, name: l.business_name || "Unnamed lead" }))}
      currentUserId={user!.id}
    />
  );
}
