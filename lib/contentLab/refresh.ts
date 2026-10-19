// Content Lab daily refresh: pulls competitor + niche-hashtag + Rome's own posts,
// scores them, stores a snapshot. Called by the daily cron and the "Refresh now" button.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccessToken } from "@/lib/integrations/connections";
import { analyzePost, type RawPost } from "./analyze";
import { accountMedia, allowedHashtags, findIgAccount, hashtagId, hashtagTopMedia, ownMedia, IgError } from "./instagram";

export type Niche = { name: string; hashtags: string[] };
export type RefreshResult = { ok: boolean; status: "done" | "not_connected" | "no_ig_account" | "error"; message: string; fetched: number; upserted: number; accounts: { username: string; posts: number; error?: string }[]; hashtags: { tag: string; posts: number; error?: string }[]; blockedHashtags: string[]; own: number; at: string };

/** The Meta connection used for reads: the team owner who connected Meta. */
async function metaOwner(service: SupabaseClient): Promise<string | null> {
  const { data } = await service.from("integration_connections").select("owner_id").eq("provider", "meta").not("access_token_enc", "is", null).limit(1).maybeSingle();
  return (data?.owner_id as string | undefined) ?? null;
}

export async function refreshContentLab(service: SupabaseClient): Promise<RefreshResult> {
  const at = new Date().toISOString();
  const res: RefreshResult = { ok: false, status: "error", message: "", fetched: 0, upserted: 0, accounts: [], hashtags: [], blockedHashtags: [], own: 0, at };
  const finish = async (r: RefreshResult) => { await service.from("content_lab_settings").update({ last_refresh_at: at, last_result: r, updated_at: at }).eq("id", 1); return r; };

  const { data: settings } = await service.from("content_lab_settings").select("*").eq("id", 1).maybeSingle();
  if (!settings) return { ...res, message: "Content Lab tables are not set up yet (migration 20261019_content_lab.sql)." };
  const owner = await metaOwner(service);
  if (!owner) return finish({ ...res, status: "not_connected", message: "Connect Meta (with Instagram permissions) in Integrations." });
  let token: string;
  try { token = (await getAccessToken("meta", owner)).token; } catch { return finish({ ...res, status: "not_connected", message: "The Meta connection needs to be reconnected in Integrations." }); }

  let igId = settings.ig_user_id as string | null;
  try {
    if (!igId) { const acct = await findIgAccount(token); if (!acct) return finish({ ...res, status: "no_ig_account", message: "No Instagram professional account is linked to a Facebook Page on this Meta login." }); igId = acct.id; await service.from("content_lab_settings").update({ ig_user_id: acct.id, ig_username: acct.username }).eq("id", 1); }
  } catch (e) { return finish({ ...res, message: e instanceof IgError ? `Instagram: ${e.message}` : "Could not read the Instagram account." }); }

  const found: { raw: RawPost; source: "account" | "hashtag" | "own"; key: string; niche: string | null }[] = [];
  const { data: accounts } = await service.from("content_watch_accounts").select("id, username, niche").eq("active", true);
  for (const a of accounts ?? []) {
    try { const posts = await accountMedia(igId!, token, a.username as string); posts.forEach((raw) => found.push({ raw, source: "account", key: a.username as string, niche: (a.niche as string | null) ?? null })); res.accounts.push({ username: a.username as string, posts: posts.length }); await service.from("content_watch_accounts").update({ last_error: null }).eq("id", a.id); }
    catch (e) { const msg = e instanceof Error ? e.message.slice(0, 200) : "failed"; res.accounts.push({ username: a.username as string, posts: 0, error: msg }); await service.from("content_watch_accounts").update({ last_error: msg }).eq("id", a.id); }
  }

  const niches = (settings.niches as Niche[]) ?? [];
  const nicheOf = new Map<string, string>(); for (const n of niches) for (const t of n.hashtags) nicheOf.set(t.replace(/^#/, "").toLowerCase(), n.name);
  const used = { ...((settings.hashtag_ids as Record<string, { id: string | null; first_used_at: string }>) ?? {}) };
  const { allowed, blocked } = allowedHashtags(Array.from(nicheOf.keys()), used);
  res.blockedHashtags = blocked;
  const week = 7 * 24 * 3600e3;
  for (const tag of allowed) {
    try {
      let entry = used[tag];
      if (!entry || Date.now() - Date.parse(entry.first_used_at) >= week || !entry.id) { const id = await hashtagId(igId!, token, tag); entry = { id, first_used_at: entry && Date.now() - Date.parse(entry.first_used_at) < week ? entry.first_used_at : at }; used[tag] = entry; }
      if (!entry.id) { res.hashtags.push({ tag, posts: 0, error: "Hashtag not found" }); continue; }
      const posts = await hashtagTopMedia(igId!, token, entry.id);
      posts.forEach((raw) => found.push({ raw, source: "hashtag", key: tag, niche: nicheOf.get(tag) ?? null }));
      res.hashtags.push({ tag, posts: posts.length });
    } catch (e) { res.hashtags.push({ tag, posts: 0, error: e instanceof Error ? e.message.slice(0, 200) : "failed" }); }
  }
  await service.from("content_lab_settings").update({ hashtag_ids: used }).eq("id", 1);

  try { const posts = await ownMedia(igId!, token); posts.forEach((raw) => found.push({ raw, source: "own", key: "own", niche: null })); res.own = posts.length; } catch { /* own media is optional */ }

  // Dedupe by media id (a post can surface via an account and a hashtag): keep the account/own source.
  const rank = { own: 0, account: 1, hashtag: 2 } as const;
  const byId = new Map<string, (typeof found)[number]>();
  for (const f of found) { const cur = byId.get(f.raw.ig_media_id); if (!cur || rank[f.source] < rank[cur.source]) byId.set(f.raw.ig_media_id, { ...f, niche: f.niche ?? cur?.niche ?? null }); }
  res.fetched = byId.size;

  const now = Date.now();
  for (const f of Array.from(byId.values())) {
    const a = analyzePost(f.raw, now);
    const row = { ig_media_id: a.ig_media_id, source: f.source, source_key: f.key, niche: f.niche, username: a.username, permalink: a.permalink, caption: a.caption, media_type: a.media_type, posted_at: a.posted_at, like_count: a.like_count, comments_count: a.comments_count, velocity: a.velocity, hook: a.hook, hook_type: a.hook_type, cta_kind: a.cta_kind, cta_keyword: a.cta_keyword, hashtags: a.hashtags, format: a.format, last_fetched_at: at };
    const { data: up, error } = await service.from("content_posts").upsert(row, { onConflict: "ig_media_id" }).select("id").single();
    if (!error && up) { res.upserted++; await service.from("content_post_snapshots").insert({ post_id: up.id, like_count: a.like_count, comments_count: a.comments_count, taken_at: at }); }
  }
  const anyData = res.fetched > 0;
  return finish({ ...res, ok: anyData || (res.accounts.length === 0 && allowed.length === 0), status: "done", message: anyData ? `Fetched ${res.fetched} posts.` : "No posts came back — see per-account / per-hashtag errors." });
}
