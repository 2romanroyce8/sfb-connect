import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  if (caller?.team_role !== "owner") return NextResponse.json({ error: "Owner access required." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const order: { id: string; sortOrder: number }[] = body.order || [];
  await Promise.all(order.map((o) => supabase.from("portfolio_projects").update({ sort_order: o.sortOrder }).eq("id", o.id)));

  return NextResponse.json({ ok: true });
}
