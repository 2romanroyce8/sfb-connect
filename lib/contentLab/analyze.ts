// Content Lab — Stage 1/2 analysis. Pure and deterministic: every label and
// every "why it's working" reason is computed from the post's own text and
// numbers. No model guesses — if we can't tell (e.g. talking head vs screen
// recording from the API), we say "unknown" and let Rome tag it.

export type RawPost = {
  ig_media_id: string;
  username: string | null;
  caption: string | null;
  media_type: string | null; // IMAGE | VIDEO | CAROUSEL_ALBUM | REELS
  permalink: string | null;
  posted_at: string | null;  // ISO
  like_count: number | null;
  comments_count: number | null;
};

export type HookType = "question" | "number_list" | "contrarian" | "how_to" | "curiosity_gap" | "pov" | "build_story" | "result_claim" | "statement";
export type CtaKind = "comment_keyword" | "save" | "follow" | "share" | "link_in_bio" | "dm" | "none";
export type Format = "reel" | "carousel" | "image" | "unknown";

export const HOOK_LABEL: Record<HookType, string> = {
  question: "Question", number_list: "Number / list", contrarian: "Contrarian / 'stop doing'", how_to: "How-to",
  curiosity_gap: "Curiosity gap", pov: "POV", build_story: "Build story ('I built…')", result_claim: "Result claim ($ / time)", statement: "Plain statement",
};
export const CTA_LABEL: Record<CtaKind, string> = {
  comment_keyword: "Comment a keyword", save: "Save this", follow: "Follow for more", share: "Share / send", link_in_bio: "Link in bio", dm: "DM me", none: "No CTA",
};
export const FORMAT_LABEL: Record<Format, string> = { reel: "Reel / video", carousel: "Carousel", image: "Single image", unknown: "Unknown" };

/** First meaningful line of the caption (emoji-only and hashtag-only lines skipped), max 140 chars. */
export function extractHook(caption: string | null | undefined): string {
  const lines = (caption ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const first = lines.find((l) => /[\p{L}\p{N}]/u.test(l.replace(/#[\p{L}\p{N}_]+/gu, "")) ) ?? "";
  const clean = first.replace(/\s+/g, " ").trim();
  return clean.length > 140 ? `${clean.slice(0, 137)}…` : clean;
}

export function classifyHook(hook: string): HookType {
  const h = hook.toLowerCase();
  if (!h) return "statement";
  if (/^pov\b|^pov:/.test(h)) return "pov";
  if (/\b(stop|don'?t|never|quit|nobody should|you'?re doing it wrong|wrong about|overrated|is dead|myth)\b/.test(h)) return "contrarian";
  if (/\b(nobody (is )?talk(s|ing)? about|secret|no one tells you|hidden|they don'?t want you|most people don'?t know|until you see)\b/.test(h)) return "curiosity_gap";
  if (/^(i|we) (built|made|shipped|launched|coded|created)\b|\bbuild(ing)? in public\b|\bday \d+\b/.test(h)) return "build_story";
  if (/\$\s?\d|\b\d+\s?(k|m)\b|\b\d+\s?(hours?|minutes?|mins?|days?|seconds?)\b|\b(revenue|mrr|made \$)/.test(h)) return "result_claim";
  if (/^how (to|i|we)\b|\bstep[- ]by[- ]step\b|\btutorial\b|\bhere'?s how\b/.test(h)) return "how_to";
  if (/^\d+\s|\btop \d+\b|\b\d+ (tools|ways|apps|tips|prompts|things|ai)\b/.test(h)) return "number_list";
  if (/\?\s*$|^(what|why|how|who|which|is|are|can|do|does|would|should)\b/.test(h)) return "question";
  return "statement";
}

/** Caption CTA. For comment-keyword CTAs ("comment 'AI' and I'll send…") the keyword is returned. */
export function detectCta(caption: string | null | undefined): { kind: CtaKind; keyword: string | null } {
  const c = (caption ?? "").replace(/[\u2018\u2019\u201C\u201D]/g, (q) => (q === "\u2018" || q === "\u2019" ? "'" : '"'));
  const kw = c.match(/\b(?:comment|type|reply|drop)\s+(?:the\s+word\s+)?["'“]?([A-Za-z0-9][A-Za-z0-9_\-]{0,24})["'”]?(?=[\s,.!:;)]|$)/i);
  if (kw && !/^(below|down|this|it|a|an|the|your|if|and|with|for)$/i.test(kw[1])) return { kind: "comment_keyword", keyword: kw[1].toUpperCase() };
  if (/\bsave (this|it|for later)\b|\bbookmark\b/i.test(c)) return { kind: "save", keyword: null };
  if (/\b(dm|message) me\b|\bsend me a dm\b/i.test(c)) return { kind: "dm", keyword: null };
  if (/\blink in (my )?bio\b/i.test(c)) return { kind: "link_in_bio", keyword: null };
  if (/\b(share|send) (this|it) (to|with)\b|\btag (a|someone)\b/i.test(c)) return { kind: "share", keyword: null };
  if (/\bfollow (me |for|@)/i.test(c)) return { kind: "follow", keyword: null };
  return { kind: "none", keyword: null };
}

export const extractHashtags = (caption: string | null | undefined) => Array.from(new Set(((caption ?? "").match(/#[\p{L}\p{N}_]+/gu) ?? []).map((t) => t.slice(1).toLowerCase()))).slice(0, 30);

export function formatOf(mediaType: string | null | undefined): Format {
  switch ((mediaType ?? "").toUpperCase()) { case "REELS": case "VIDEO": return "reel"; case "CAROUSEL_ALBUM": return "carousel"; case "IMAGE": return "image"; default: return "unknown"; }
}

/** Engagement velocity: (likes + comments) per hour since posting. Floor of 1 hour so brand-new posts don't explode. */
export function velocity(p: Pick<RawPost, "like_count" | "comments_count" | "posted_at">, now: number = Date.now()): number | null {
  if (!p.posted_at) return null;
  const hours = Math.max(1, (now - Date.parse(p.posted_at)) / 3600e3);
  const eng = (p.like_count ?? 0) + (p.comments_count ?? 0);
  return Math.round((eng / hours) * 100) / 100;
}

/** Post hour (0–23) in America/New_York. */
export function etHour(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const h = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(new Date(iso));
  return Number(h) % 24;
}

export type AnalyzedPost = RawPost & { hook: string; hook_type: HookType; cta_kind: CtaKind; cta_keyword: string | null; hashtags: string[]; format: Format; velocity: number | null; comment_ratio: number | null; post_hour_et: number | null };

export function analyzePost(p: RawPost, now: number = Date.now()): AnalyzedPost {
  const hook = extractHook(p.caption);
  const cta = detectCta(p.caption);
  const likes = p.like_count ?? 0, comments = p.comments_count ?? 0;
  return { ...p, hook, hook_type: classifyHook(hook), cta_kind: cta.kind, cta_keyword: cta.keyword, hashtags: extractHashtags(p.caption), format: formatOf(p.media_type), velocity: velocity(p, now), comment_ratio: likes > 0 ? Math.round((comments / likes) * 1000) / 1000 : null, post_hour_et: etHour(p.posted_at) };
}

export const median = (xs: number[]) => { const a = xs.filter((x) => Number.isFinite(x)).sort((x, y) => x - y); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

/** "Why it's working": reasons computed against the cohort (same niche). Only facts we can see. */
export function whyWorking(post: AnalyzedPost, cohort: AnalyzedPost[]): string[] {
  const reasons: string[] = [];
  const medV = median(cohort.map((c) => c.velocity ?? NaN));
  if (post.velocity != null && medV && medV > 0) { const x = post.velocity / medV; if (x >= 1.5) reasons.push(`${x >= 10 ? Math.round(x) : x.toFixed(1)}× the niche's median velocity (${post.velocity}/h vs ${Math.round(medV * 10) / 10}/h)`); }
  const medR = median(cohort.map((c) => c.comment_ratio ?? NaN));
  if (post.comment_ratio != null && medR && post.comment_ratio >= medR * 2 && (post.comments_count ?? 0) >= 20) reasons.push(`Comment-heavy: ${Math.round(post.comment_ratio * 100)} comments per 100 likes (niche median ${Math.round(medR * 100)})`);
  if (post.cta_kind === "comment_keyword") reasons.push(`Comment-keyword CTA ("${post.cta_keyword}") turns the reply box into the lead magnet`);
  else if (post.cta_kind !== "none") reasons.push(`Explicit CTA: ${CTA_LABEL[post.cta_kind]}`);
  if (post.hook_type !== "statement") reasons.push(`${HOOK_LABEL[post.hook_type]} hook`);
  if (post.hook && post.hook.length <= 60) reasons.push("Short hook (≤60 chars) — readable in the first second");
  return reasons;
}
