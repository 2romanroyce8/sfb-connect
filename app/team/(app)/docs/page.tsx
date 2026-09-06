import { createSupabaseServerClient } from "@/lib/supabase/server";
import DocsWorkspace from "@/components/team/DocsWorkspace";

const CATEGORY_META: { key: string; title: string; description: string; icon: string }[] = [
  { key: "sales_sop", title: "Sales SOP", description: "Daily procedures, required workflows, role expectations, and sales execution standards.", icon: "Workflow" },
  { key: "sales_scripts", title: "Sales Scripts", description: "Approved call scripts, openings, receptionist paths, meeting asks, and current offer messaging.", icon: "MessageSquareText" },
  { key: "objection_library", title: "Objection Library", description: "Live objection trees, reframes, clarification paths, and response frameworks for sales reps.", icon: "GitBranch" },
  { key: "ai_presence_knowledge", title: "AI Presence Knowledge", description: "Core AI Presence concepts, positioning, audit logic, platform education, and sales knowledge.", icon: "BrainCircuit" },
  { key: "website_services", title: "Website Services", description: "Website rebuilds, new builds, packages, positioning, service scope, and delivery standards.", icon: "Monitor" },
  { key: "training_onboarding", title: "Training & Onboarding", description: "Rep onboarding, practice materials, quizzes, role training, and certification content.", icon: "GraduationCap" },
];

// This page lives inside the (app) route group, so it inherits the shared
// TeamAppShell (TeamSidebar + AccountWorkspaceMenu) from layout.tsx exactly
// like every other /team/* page -- no separate auth guard or shell markup
// needed here, matching the established pattern (see pipeline/research/etc).
export default async function TeamDocsPage({ searchParams }: { searchParams: { category?: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user!.id).single();
  const isOwner = caller?.team_role === "owner";

  const activeCategory = searchParams.category;

  const [{ data: allDocs }, { data: folders }, { data: folderItems }, { data: activity30 }, { data: bookmarks }] = await Promise.all([
    supabase.from("crm_documents").select("id, title, category, description, file_path, file_type, file_size_bytes, visibility, published, created_by, created_at, updated_at").order("created_at", { ascending: false }),
    supabase.from("crm_document_folders").select("id, name, icon, sort_order").order("sort_order", { ascending: true }),
    supabase.from("crm_document_folder_items").select("folder_id, document_id"),
    supabase.from("crm_document_activity").select("event_type, created_at").gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
    supabase.from("crm_document_bookmarks").select("document_id").eq("user_id", user!.id),
  ]);

  const creatorIds = Array.from(new Set((allDocs ?? []).map((d) => d.created_by).filter(Boolean)));
  const { data: creators } = creatorIds.length ? await supabase.from("users").select("id, full_name, email").in("id", creatorIds) : { data: [] as any[] };
  const creatorNames = Object.fromEntries((creators ?? []).map((c) => [c.id, c.full_name || c.email]));

  const categoryCounts: Record<string, number> = {};
  for (const d of allDocs ?? []) categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1;

  const folderCounts: Record<string, number> = {};
  for (const fi of folderItems ?? []) folderCounts[fi.folder_id] = (folderCounts[fi.folder_id] || 0) + 1;

  const bookmarkedIds = new Set((bookmarks ?? []).map((b) => b.document_id));

  const allDocsResolved = (allDocs ?? []).map((d) => ({
    ...d,
    creator_name: d.created_by ? creatorNames[d.created_by] || null : null,
    bookmarked: bookmarkedIds.has(d.id),
  }));

  return (
    <DocsWorkspace
      isOwner={isOwner}
      categories={CATEGORY_META.map((c) => ({ ...c, count: categoryCounts[c.key] || 0 }))}
      folders={(folders ?? []).map((f) => ({ ...f, count: folderCounts[f.id] || 0 }))}
      activity30={activity30 ?? []}
      allDocs={allDocsResolved as any}
      activeCategory={activeCategory || null}
    />
  );
}
