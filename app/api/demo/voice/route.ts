import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/agent/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tradeByKey, type Trade } from "@/lib/mk/trades";
import { getPublicDemo, demoToTrade } from "@/lib/agency/demoPublic";
import { receptionistPrompt } from "@/lib/mk/voicePrompt";
import { ensureAgent, ensureOverrides, inspectAgent, signedUrl, voiceConfigured } from "@/lib/mk/elevenlabs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Public voice-demo gate. GET = is voice configured (so the UI never shows a dead button). POST = start one capped session.
// Caps: 4 sessions/hour per IP and DAILY_CAP sessions/day overall (each call is limited to 180 s by the agent config). Prompt is built here from a trade KEY only.
const DAILY_CAP = Number(process.env.VOICE_DEMO_DAILY_SESSIONS || 40);
async function isTeam() { try { const db = createSupabaseServerClient(); const { data: { user } } = await db.auth.getUser(); if (!user) return false; const { data: p } = await db.from("users").select("team_role").eq("id", user.id).maybeSingle(); return !!p?.team_role; } catch { return false; } }
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("debug") === "1" && voiceConfigured() && (await isTeam())) { try { return NextResponse.json(await inspectAgent(await ensureAgent())); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 400) : "failed" }, { status: 502 }); } }
  return NextResponse.json({ configured: voiceConfigured() });
}

export async function POST(req: NextRequest) {
  if (!voiceConfigured()) return NextResponse.json({ error: "Live voice isn't configured yet." }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { trade?: string; agency?: string; slug?: string };
  let trade: Trade | null = null;
  if (typeof body.agency === "string" && typeof body.slug === "string") { const d = await getPublicDemo(body.agency, body.slug); if (d) trade = demoToTrade(d); } else trade = tradeByKey(body.trade);
  if (!trade) return NextResponse.json({ error: "Unknown demo." }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const per = await rateLimit(`voicedemo:${ip}:1h`, 4, 3600);
  if (!per.allowed) return NextResponse.json({ error: "You've reached the hourly limit for live demo calls. Try again later." }, { status: 429 });
  const day = await rateLimit(`voicedemo:all:${new Date().toISOString().slice(0, 10)}`, DAILY_CAP, 86400);
  if (!day.allowed) return NextResponse.json({ error: "Today's live demo capacity is used up. Try again tomorrow." }, { status: 429 });
  try {
    const agentId = await ensureAgent();
    await ensureOverrides(agentId);
    const url = await signedUrl(agentId);
    return NextResponse.json({ signedUrl: url, overrides: { agent: { prompt: { prompt: receptionistPrompt(trade) } } }, maxSeconds: 180 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[voice-demo]", msg);
    // The upstream message (never the key) is shown only to a signed-in team member, for debugging.
    let detail: string | undefined;
    try { const db = createSupabaseServerClient(); const { data: { user } } = await db.auth.getUser(); if (user) { const { data: p } = await db.from("users").select("team_role").eq("id", user.id).maybeSingle(); if (p?.team_role) detail = msg.slice(0, 400); } } catch { /* ignore */ }
    return NextResponse.json({ error: "The voice service couldn't start the call. Please try again.", ...(detail ? { detail } : {}) }, { status: 502 });
  }
}
