import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAgencyContext } from "@/lib/agency/context";
import { slugify } from "@/lib/agency/slug";
export const dynamic = "force-dynamic";

// Demo create/publish. The agency comes from the signed-in membership (never the request body) and every write uses the SESSION client,
// so RLS (agy_is_member with a sales role) is the authority, not this route.
export async function POST(req: NextRequest) {
  const r = await getAgencyContext(); if (r.status !== "ok") return NextResponse.json({ error: "Not signed in to an agency." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>; const s = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : "");
  const db = createSupabaseServerClient();
  if (b.action === "create") {
    const name = s("business_name"); if (name.length < 2 || name.length > 120) return NextResponse.json({ error: "Business name must be 2–120 characters." }, { status: 400 });
    let site = s("website_url"); if (site && !/^https?:\/\//i.test(site)) site = `https://${site}`; if (site) { try { new URL(site); } catch { return NextResponse.json({ error: "That website URL isn't valid." }, { status: 400 }); } }
    const base = slugify(name) || "demo";
    for (let i = 0; i < 5; i++) {
      const slug = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
      const { error } = await db.from("agy_demo_projects").insert({ agency_id: r.ctx.agencyId, slug, business_name: name, website_url: site || null, industry_key: s("industry_key") || null, created_by: r.ctx.userId });
      if (!error) return NextResponse.json({ ok: true, slug });
      if (error.code !== "23505") return NextResponse.json({ error: error.code === "42501" ? "Your role can't create demos." : error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Couldn't find a free link for that name." }, { status: 409 });
  }
  if (b.action === "publish" || b.action === "unpublish") {
    const { data, error } = await db.from("agy_demo_projects").update({ status: b.action === "publish" ? "published" : "draft", updated_at: new Date().toISOString() }).eq("id", s("id")).eq("agency_id", r.ctx.agencyId).select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data?.length) return NextResponse.json({ error: "Demo not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
