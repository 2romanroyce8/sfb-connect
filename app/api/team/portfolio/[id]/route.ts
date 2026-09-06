import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireOwner() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  if (caller?.team_role !== "owner") return { error: NextResponse.json({ error: "Owner access required." }, { status: 403 }) };
  return { supabase };
}

const FIELD_MAP: Record<string, string> = {
  businessName: "business_name",
  industry: "industry",
  location: "location",
  year: "year",
  projectType: "project_type",
  shortDescription: "short_description",
  caseStudy: "case_study",
  websiteUrl: "website_url",
  coverImageUrl: "cover_image_url",
  featured: "featured",
  published: "published",
  sortOrder: "sort_order",
  slug: "slug",
};

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;
  const { supabase } = ctx;
  const body = await req.json().catch(() => ({}));

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [key, column] of Object.entries(FIELD_MAP)) {
    if (key in body) updates[column] = body[key];
  }

  if (Object.keys(updates).length > 1) {
    const { error } = await supabase.from("portfolio_projects").update(updates).eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Services are a full-replace list, not a diff -- simpler and matches how
  // the admin form always submits the complete current list.
  if (Array.isArray(body.services)) {
    await supabase.from("portfolio_services").delete().eq("project_id", params.id);
    if (body.services.length > 0) {
      await supabase.from("portfolio_services").insert(body.services.map((s: string) => ({ project_id: params.id, service: s })));
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;
  const { error } = await ctx.supabase.from("portfolio_projects").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
