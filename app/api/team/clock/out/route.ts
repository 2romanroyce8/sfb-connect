import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: active } = await supabase.from("team_work_sessions").select("id, clocked_in_at").eq("rep_id", user.id).eq("status", "active").maybeSingle();
  if (!active) return NextResponse.json({ error: "Not currently clocked in." }, { status: 400 });

  const clockedOutAt = new Date();
  const durationSeconds = Math.max(0, Math.round((clockedOutAt.getTime() - new Date(active.clocked_in_at).getTime()) / 1000));

  const { error } = await supabase
    .from("team_work_sessions")
    .update({ clocked_out_at: clockedOutAt.toISOString(), duration_seconds: durationSeconds, status: "ended" })
    .eq("id", active.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("crm_activities").insert({ rep_id: user.id, activity_type: "clocked_out", description: "Clocked out — Personal Mode" });
  return NextResponse.json({ ok: true, durationSeconds });
}
