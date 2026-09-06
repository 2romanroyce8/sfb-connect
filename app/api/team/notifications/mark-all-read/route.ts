import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  await supabase.from("crm_notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("is_read", false);
  return NextResponse.json({ ok: true });
}
