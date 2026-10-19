// Instagram Graph API reads for the Content Lab ($0, official API).
// - Competitor accounts: Business Discovery (public media of Business/Creator accounts).
// - Niche hashtags: Hashtag Search top_media (Meta caps an account at 30 unique hashtags per rolling 7 days;
//   needs the "Instagram Public Content Access" feature on the Meta app).
// Token: the team owner's Meta connection (needs instagram_basic + pages_read_engagement + pages_show_list).
import type { RawPost } from "./analyze";

const G = "https://graph.facebook.com/v21.0";
const MEDIA_FIELDS = "id,caption,like_count,comments_count,media_type,permalink,timestamp";
export const HASHTAG_WEEKLY_CAP = 30;

export class IgError extends Error { code: string; constructor(code: string, message: string) { super(message); this.code = code; } }

async function get(path: string, token: string, params: Record<string, string> = {}) {
  const u = new URL(`${G}${path}`); for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v); u.searchParams.set("access_token", token);
  const r = await fetch(u, { cache: "no-store" }); const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok || j.error) { const e = (j.error ?? {}) as { message?: string; code?: number }; throw new IgError(String(e.code ?? r.status), e.message ?? `Instagram API ${r.status}`); }
  return j;
}

/** The Instagram professional account linked to one of the owner's Facebook Pages. */
export async function findIgAccount(token: string): Promise<{ id: string; username: string } | null> {
  const j = await get("/me/accounts", token, { fields: "name,instagram_business_account{id,username}", limit: "50" });
  for (const p of (j.data as { instagram_business_account?: { id: string; username: string } }[]) ?? []) if (p.instagram_business_account?.id) return p.instagram_business_account;
  return null;
}

type M = { id: string; caption?: string; like_count?: number; comments_count?: number; media_type?: string; permalink?: string; timestamp?: string; username?: string };
const toRaw = (m: M, username: string | null): RawPost => ({ ig_media_id: m.id, username: m.username ?? username, caption: m.caption ?? null, media_type: m.media_type ?? null, permalink: m.permalink ?? null, posted_at: m.timestamp ? new Date(m.timestamp).toISOString() : null, like_count: m.like_count ?? null, comments_count: m.comments_count ?? null });

export async function accountMedia(igUserId: string, token: string, username: string, limit = 25): Promise<RawPost[]> {
  const u = username.replace(/^@/, "").trim();
  const j = await get(`/${igUserId}`, token, { fields: `business_discovery.username(${u}){username,media.limit(${limit}){${MEDIA_FIELDS}}}` });
  const bd = j.business_discovery as { username?: string; media?: { data?: M[] } } | undefined;
  return (bd?.media?.data ?? []).map((m) => toRaw(m, bd?.username ?? u));
}

export async function hashtagId(igUserId: string, token: string, tag: string): Promise<string | null> {
  const j = await get("/ig_hashtag_search", token, { user_id: igUserId, q: tag });
  return ((j.data as { id: string }[]) ?? [])[0]?.id ?? null;
}

export async function hashtagTopMedia(igUserId: string, token: string, hid: string, limit = 25): Promise<RawPost[]> {
  const j = await get(`/${hid}/top_media`, token, { user_id: igUserId, fields: MEDIA_FIELDS, limit: String(limit) });
  return ((j.data as M[]) ?? []).map((m) => toRaw(m, null));
}

export async function ownMedia(igUserId: string, token: string, limit = 25): Promise<RawPost[]> {
  const j = await get(`/${igUserId}/media`, token, { fields: `${MEDIA_FIELDS},username`, limit: String(limit) });
  return ((j.data as M[]) ?? []).map((m) => toRaw(m, null));
}

/** Pure: which hashtags may be queried now without exceeding Meta's 30-per-7-days cap. Re-querying a known tag is free. */
export function allowedHashtags(wanted: string[], used: Record<string, { first_used_at: string }>, now = Date.now()): { allowed: string[]; blocked: string[] } {
  const week = 7 * 24 * 3600e3;
  const active = new Set(Object.entries(used).filter(([, v]) => now - Date.parse(v.first_used_at) < week).map(([k]) => k));
  const allowed: string[] = [], blocked: string[] = [];
  for (const t of Array.from(new Set(wanted.map((w) => w.replace(/^#/, "").toLowerCase()).filter(Boolean)))) {
    if (active.has(t)) allowed.push(t);
    else if (active.size < HASHTAG_WEEKLY_CAP) { active.add(t); allowed.push(t); }
    else blocked.push(t);
  }
  return { allowed, blocked };
}
