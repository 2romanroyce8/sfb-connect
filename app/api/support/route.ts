import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const message = body?.message as string | undefined;
  if (!message) return NextResponse.json({ error: "message is required." }, { status: 400 });

  const service = createSupabaseServiceClient();
  const { data: business } = await service
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!business) return NextResponse.json({ error: "No business on file." }, { status: 404 });

  const { error } = await service.from("support_messages").insert({
    business_id: business.id,
    sender_role: "customer",
    sender_id: user.id,
    message,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
