import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { etHour, whyWorking, type AnalyzedPost, type CtaKind, type Format, type HookType } from "@/lib/contentLab/analyze";
import { analyzePatterns, PACKAGING_PRINCIPLE } from "@/lib/contentLab/patterns";
import { refreshContentLab, type Niche } from "@/lib/contentLab/refresh";
import { HASHTAG_WEEKLY_CAP } from "@/lib/contentLab/instagram";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Content Lab (Phase 1: Trend Radar + Pattern Analyzer). Owner only. Read-only — nothing is posted.
async function owner() {
  const supabase = createSupabaseServerClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return null;
  const { data: me } = await supabase.from("users").select("id, team_role").eq("id", user.id).single();
  return me?.team_role === "owner" ? me : null;
}

type Row = { id: string; ig_media_id: string; source: string; source_key: string | null; niche: string | null; username: string | null; permalink: string | null; caption: string | null; media_type: string | null; posted_at: string | null; like_count: number | null; comments_count: number | null; velocity: number | null; hook: string | null; hook_type: string | null; cta_kind: string | null; cta_keyword: string | null; hashtags: string[]; format: string | null; format_tag: string | null; last_fetched_at: string };
const toAnalyzed = (r: Row): AnalyzedPost & { id: string; source: string; source_key: string | null; niche: string | null; format_tag: string | null; last_fetched_at: string } => {
  const likes = r.like_count ?? 0;
  return { ...r, caption: r.caption, hook: r.hook ?? "", hook_type: (r.hook_type ?? "statement") as HookType, cta_kind: (r.cta_kind ?? "none") as CtaKind, cta_keyword: r.cta_keyword, hashtags: r.hashtags ?? [], format: (r.format ?? "unknown") as Format, velocity: r.velocity == null ? null : Number(r.velocity), comment_ratio: likes > 0 ? Math.round(((r.comments_count ?? 0) / likes) * 1000) / 1000 : null, post_hour_et: etHour(r.posted_at) };
};

export async function GET(req: NextRequest) {
  if (!(await owner())) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const service = createSupabaseServiceClient();
  const { data: settings, error: setErr } = await service.from("content_lab_settings").select("niches, ig_username, hashtag_ids, last_refresh_at, last_result").eq("id", 1).maybeSingle();
  if (setErr || !settings) return NextResponse.json({ setupNeeded: true, message: "Database setup pending: apply supabase/migrations/20261019_content_lab.sql." });
  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get("days") ?? 7)));
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const [{ data: accounts }, { data: rows }, { data: meta }] = await Promise.all([
    service.from("content_watch_accounts").select("id, username, niche, active, last_error, created_at").order("created_at"),
    service.from("content_posts").select("*").gte("posted_at", since).order("velocity", { ascending: false, nullsFirst: false }).limit(400),
    service.from("integration_connections").select("status, account_label, provider").in("provider", ["meta_instagram", "meta"]).order("provider", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const posts = ((rows ?? []) as Row[]).map(toAnalyzed);
  const byNiche = new Map<string, typeof posts>(); for (const p of posts) { const k = p.niche ?? "—"; byNiche.set(k, [...(byNiche.get(k) ?? []), p]); }
  const radar = posts.filter((p) => p.source !== "own").map((p) => ({ ...p, why: whyWorking(p, byNiche.get(p.niche ?? "—") ?? posts) }));
  const own = posts.filter((p) => p.source === "own");
  const hashtagsUsed = Object.entries((settings.hashtag_ids as Record<string, { first_used_at: string }>) ?? {}).filter(([, v]) => Date.now() - Date.parse(v.first_used_at) < 7 * 864e5).length;
  return NextResponse.json({
    setupNeeded: false, niches: settings.niches, igUsername: settings.ig_username, lastRefreshAt: settings.last_refresh_at, lastResult: settings.last_result,
    meta: meta ? { status: meta.status, label: meta.account_label, instagram: meta.provider === "meta_instagram" } : null, accounts: accounts ?? [], days,
    radar, own, patterns: analyzePatterns(posts.filter((p) => p.source !== "own")), principle: PACKAGING_PRINCIPLE, hashtagBudget: { used: hashtagsUsed, cap: HASHTAG_WEEKLY_CAP },
  });
}

const FORMAT_TAGS = ["talking_head", "screen_recording", "text_overlay", "other"];

export async function POST(req: NextRequest) {
  if (!(await owner())) return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  const service = createSupabaseServiceClient();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const s = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : "");
  try {
    switch (b.action) {
      case "save_niches": {
        const niches = (Array.isArray(b.niches) ? b.niches : []).map((n) => ({ name: String((n as Niche).name ?? "").trim().slice(0, 60), hashtags: Array.from(new Set(((n as Niche).hashtags ?? []).map((t) => String(t).replace(/^#/, "").toLowerCase().replace(/[^\p{L}\p{N}_]/gu, "")).filter(Boolean))).slice(0, 10) })).filter((n) => n.name && n.hashtags.length);
        const total = new Set(niches.flatMap((n) => n.hashtags)).size;
        if (total > HASHTAG_WEEKLY_CAP) return NextResponse.json({ error: `Instagram allows ${HASHTAG_WEEKLY_CAP} unique hashtags per week; this list has ${total}.` }, { status: 400 });
        await service.from("content_lab_settings").update({ niches, updated_at: new Date().toISOString() }).eq("id", 1);
        return NextResponse.json({ ok: true, niches });
      }
      case "add_account": {
        const username = s("username").replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "").toLowerCase();
        if (!/^[a-z0-9._]{1,30}$/.test(username)) return NextResponse.json({ error: "That isn't a valid Instagram username." }, { status: 400 });
        const { error } = await service.from("content_watch_accounts").insert({ username, niche: s("niche") || null });
        if (error) return NextResponse.json({ error: error.code === "23505" ? "Already watching that account." : error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      case "remove_account": await service.from("content_watch_accounts").delete().eq("id", s("id")); return NextResponse.json({ ok: true });
      case "toggle_account": await service.from("content_watch_accounts").update({ active: b.active !== false }).eq("id", s("id")); return NextResponse.json({ ok: true });
      case "tag_format": {
        const tag = s("format_tag"); if (tag && !FORMAT_TAGS.includes(tag)) return NextResponse.json({ error: "Unknown format." }, { status: 400 });
        await service.from("content_posts").update({ format_tag: tag || null }).eq("id", s("id")); return NextResponse.json({ ok: true });
      }
      case "refresh": return NextResponse.json({ ok: true, result: await refreshContentLab(service) });
      default: return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Request failed." }, { status: 500 }); }
}
