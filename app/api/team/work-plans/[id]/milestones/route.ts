import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  if (caller?.team_role !== "owner") return NextResponse.json({ error: "Only the owner can add milestones." }, { status: 403 });

  const { title, date, description } = await req.json();
  if (!title || !date) return NextResponse.json({ error: "Title and date are required." }, { status: 400 });

  const { data: milestone, error } = await supabase
    .from("crm_work_plan_milestones")
    .insert({ work_plan_id: params.id, title, date, description: description || null })
    .select("*")
    .single();
  if (error || !milestone) return NextResponse.json({ error: error?.message || "Could not add milestone." }, { status: 400 });

  return NextResponse.json(milestone);
}
