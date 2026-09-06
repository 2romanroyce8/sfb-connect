import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Owner-only portfolio CRUD. Uses the session (anon-key) client throughout
// so RLS (portfolio_projects_owner_write: is_team_owner()) is what actually
// authorizes every write here -- not a bypassed service-role shortcut.
async function requireOwner() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  if (caller?.team_role !== "owner") return { error: NextResponse.json({ error: "Owner access required." }, { status: 403 }) };
  return { supabase, userId: user.id };
}

export async function GET() {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;
  const { data: projects } = await ctx.supabase.from("portfolio_projects").select("*").order("sort_order", { ascending: true });
  return NextResponse.json({ projects: projects ?? [] });
}

export async function POST(req: NextRequest) {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;
  const { supabase, userId } = ctx;
  const body = await req.json().catch(() => ({}));

  const slug: string = (body.slug || body.businessName || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug || !body.businessName || !body.projectType) {
    return NextResponse.json({ error: "Business name, project type, and a derivable slug are required." }, { status: 400 });
  }

  const { data: maxRow } = await supabase.from("portfolio_projects").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const nextSort = (maxRow?.sort_order ?? -1) + 1;

  const { data: project, error } = await supabase
    .from("portfolio_projects")
    .insert({
      slug,
      business_name: body.businessName,
      industry: body.industry || null,
      location: body.location || null,
      year: body.year || null,
      project_type: body.projectType,
      short_description: body.shortDescription || null,
      case_study: body.caseStudy || {},
      website_url: body.websiteUrl || null,
      featured: !!body.featured,
      published: !!body.published,
      sort_order: nextSort,
      created_by: userId,
    })
    .select("*")
    .single();

  if (error || !project) return NextResponse.json({ error: error?.message || "Could not create project. Slug may already be taken." }, { status: 400 });

  if (Array.isArray(body.services) && body.services.length > 0) {
    await supabase.from("portfolio_services").insert(body.services.map((s: string) => ({ project_id: project.id, service: s })));
  }

  return NextResponse.json({ project });
}
