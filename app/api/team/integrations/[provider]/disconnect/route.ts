import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteConnection } from "@/lib/integrations/connections";

export const runtime = "nodejs";

/** Removes the signed-in member's own connection for a provider. */
export async function POST(_req: NextRequest, { params }: { params: { provider: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!/^[a-z_]+$/.test(params.provider)) return NextResponse.json({ error: "Unknown integration" }, { status: 404 });
  await deleteConnection(params.provider, user.id);
  return NextResponse.json({ ok: true });
}
