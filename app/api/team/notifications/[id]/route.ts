import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// RLS (user_id = auth.uid()) governs both actions directly -- a user can
// only ever mark read/dismiss their own notifications.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { action } = await req.json();
  const update: Record<string, unknown> =
    action === "dismiss" ? { is_dismissed: true } : { is_read: true, read_at: new Date().toISOString() };

  const { error } = await supabase.from("crm_notifications").update(update).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
