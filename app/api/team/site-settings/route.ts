import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/team/requireOwner";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLS = "walkthrough_video_url, walkthrough_poster_url, updated_at, updated_by";

/** Owner-only. The homepage reads the same row server-side (AgentSection). */
export async function GET() {
  const gate = await requireOwner(); if ("error" in gate) return gate.error;
  const { data } = await createSupabaseServiceClient().from("site_settings").select(COLS).eq("id", 1).maybeSingle();
  return NextResponse.json({ settings: data ?? { walkthrough_video_url: null, walkthrough_poster_url: null, updated_at: null, updated_by: null } });
}

function cleanUrl(v: unknown): string | null | { error: string } {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string") return { error: "URL must be text." };
  const s = v.trim(); if (!s) return null;
  try { const u = new URL(s); if (u.protocol !== "https:") return { error: "Use an https:// URL." }; return u.toString(); } catch { return { error: "That isn't a valid URL." }; }
}

/** { walkthrough_video_url?: string|null, walkthrough_poster_url?: string|null } — https only; null clears (section goes back to the honest "coming" state). */
export async function POST(req: NextRequest) {
  const gate = await requireOwner(); if ("error" in gate) return gate.error;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const video = cleanUrl(body.walkthrough_video_url); if (video && typeof video === "object") return NextResponse.json(video, { status: 400 });
  const poster = cleanUrl(body.walkthrough_poster_url); if (poster && typeof poster === "object") return NextResponse.json(poster, { status: 400 });
  const service = createSupabaseServiceClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: gate.userId };
  if ("walkthrough_video_url" in body) patch.walkthrough_video_url = video;
  if ("walkthrough_poster_url" in body) patch.walkthrough_poster_url = poster;
  const { error } = await service.from("site_settings").update(patch).eq("id", 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data } = await service.from("site_settings").select(COLS).eq("id", 1).maybeSingle();
  return NextResponse.json({ ok: true, settings: data });
}
