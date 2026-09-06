import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Polled by the Research Queue page so a job started from a different tab
// or by a different rep (owner view) still shows a live compact progress
// card without needing a persistent connection. RLS (crm_research_team_read)
// scopes this to jobs the viewer started, or every job if they're the owner.
export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: jobs } = await supabase
    .from("crm_research_jobs")
    .select("id, started_for, status, current_step, progress_percent, sources_found, created_at, updated_at")
    .eq("status", "running")
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ jobs: jobs ?? [] });
}
