import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { SLUG_RE, slugify } from "@/lib/agency/slug";
export const dynamic = "force-dynamic";

// Agency signup: the signed-in user creates their own agency and becomes its owner. Owner id comes from the session, never the body.
// One agency per user for now. Inserts use the service client because tenants can't insert into agencies/agency_members directly (by design).
export async function POST(req: NextRequest) {
  const db = createSupabaseServerClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { name?: string; slug?: string };
  const name = (b.name ?? "").trim(); const slug = (b.slug ? slugify(b.slug) : slugify(name));
  if (name.length < 2 || name.length > 120) return NextResponse.json({ error: "Agency name must be 2–120 characters." }, { status: 400 });
  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: "Pick a link of 3–40 letters, numbers or dashes." }, { status: 400 });
  const svc = createSupabaseServiceClient();
  const { data: existing } = await svc.from("agency_members").select("agency_id").eq("user_id", user.id).limit(1);
  if (existing?.length) return NextResponse.json({ ok: true, existing: true });
  const { data: ag, error } = await svc.from("agencies").insert({ name, slug, owner_id: user.id }).select("id").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "That link is taken. Try another." : error.message }, { status: error.code === "23505" ? 409 : 400 });
  const m = await svc.from("agency_members").insert({ agency_id: ag.id, user_id: user.id, role: "owner" });
  if (m.error) { await svc.from("agencies").delete().eq("id", ag.id); return NextResponse.json({ error: "Couldn't finish setup. Try again." }, { status: 500 }); }
  await svc.from("agency_branding").insert({ agency_id: ag.id, display_name: name });
  return NextResponse.json({ ok: true });
}
