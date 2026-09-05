import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { disconnectGoogleCalendar } from "@/lib/crm/googleCalendar";

export async function POST() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  await disconnectGoogleCalendar(user.id);
  return NextResponse.json({ ok: true });
}
