import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { saveProfile, FunnelError } from "@/lib/funnel/signup";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Step 3 — the confirmed profile from the build show. Verified session required; pricing unlocks after this. */
export async function POST(req: NextRequest) {
  const { data: { user } } = await createSupabaseServerClient().auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue.", restart: true }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const profile = await saveProfile(createSupabaseServiceClient(), user.id, b);
    return NextResponse.json({ ok: true, profile });
  } catch (e) {
    if (e instanceof FunnelError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    console.error("[funnel-profile]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Something failed on our side. It was logged — please try again." }, { status: 500 });
  }
}
