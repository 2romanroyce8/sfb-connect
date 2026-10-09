import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/team/requireOwner";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
export const dynamic = "force-dynamic";

const STATUSES = new Set(["live", "unlocking_next", "roadmap"]);

export async function GET() {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;
  const { data, error } = await createSupabaseServiceClient().from("agent_program_modules").select("key, position, name, status, tagline, description, updated_at").order("position");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ modules: data ?? [] });
}

// Owner changes a module's public status; /agent and the homepage teaser
// re-render on the next request (ISR revalidated here).
export async function PATCH(req: NextRequest) {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;
  const body = (await req.json().catch(() => ({}))) as { key?: string; status?: string };
  if (!body.key || !body.status || !STATUSES.has(body.status)) return NextResponse.json({ error: "key and a valid status are required" }, { status: 400 });
  const { data, error } = await createSupabaseServiceClient().from("agent_program_modules").update({ status: body.status, updated_at: new Date().toISOString(), updated_by: ctx.userId }).eq("key", body.key).select("key, status").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Unknown module" }, { status: 404 });
  revalidatePath("/agent"); revalidatePath("/");
  return NextResponse.json({ ok: true, module: data });
}
