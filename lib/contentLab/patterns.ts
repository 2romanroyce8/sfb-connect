// Content Lab — Stage 2 Pattern Analyzer. Cross-compares tracked posts.
// Pure. Small samples are labelled as such instead of being presented as
// findings (a group needs MIN_N posts before it can "win").
import { CTA_LABEL, FORMAT_LABEL, HOOK_LABEL, median, type AnalyzedPost, type CtaKind, type Format, type HookType } from "./analyze";

export const MIN_N = 3;

export type GroupStat = { key: string; label: string; n: number; medianVelocity: number | null; medianComments: number | null; medianLikes: number | null; enough: boolean; lift: number | null; example: { hook: string; permalink: string | null; username: string | null } | null };

function group<K extends string>(posts: AnalyzedPost[], keyOf: (p: AnalyzedPost) => K | null, labelOf: (k: K) => string): GroupStat[] {
  const overall = median(posts.map((p) => p.velocity ?? NaN));
  const by = new Map<K, AnalyzedPost[]>();
  for (const p of posts) { const k = keyOf(p); if (k == null) continue; by.set(k, [...(by.get(k) ?? []), p]); }
  return Array.from(by.entries()).map(([k, ps]) => {
    const mv = median(ps.map((p) => p.velocity ?? NaN));
    const best = [...ps].sort((a, b) => (b.velocity ?? 0) - (a.velocity ?? 0))[0];
    return { key: k, label: labelOf(k), n: ps.length, medianVelocity: mv, medianComments: median(ps.map((p) => p.comments_count ?? NaN)), medianLikes: median(ps.map((p) => p.like_count ?? NaN)), enough: ps.length >= MIN_N, lift: mv != null && overall ? Math.round((mv / overall) * 100) / 100 : null, example: best ? { hook: best.hook, permalink: best.permalink, username: best.username } : null };
  }).sort((a, b) => Number(b.enough) - Number(a.enough) || (b.medianVelocity ?? 0) - (a.medianVelocity ?? 0));
}

const hourLabel = (h: string) => { const n = Number(h); return `${n % 12 === 0 ? 12 : n % 12}${n < 12 ? "am" : "pm"}–${(n + 1) % 12 === 0 ? 12 : (n + 1) % 12}${n + 1 < 12 || n + 1 === 24 ? "am" : "pm"} ET`; };

export type TestableVariable = { key: "hook_text" | "cta_keyword" | "hashtags" | "thumbnail_frame" | "post_time"; label: string; evidence: string; suggestion: string; measurable: boolean };

export function analyzePatterns(posts: AnalyzedPost[]) {
  const byHook = group<HookType>(posts, (p) => p.hook_type, (k) => HOOK_LABEL[k]);
  // Comments are the metric for CTAs: saves are not exposed for other accounts' posts.
  const byCta = group<CtaKind>(posts, (p) => p.cta_kind, (k) => CTA_LABEL[k]).sort((a, b) => Number(b.enough) - Number(a.enough) || (b.medianComments ?? 0) - (a.medianComments ?? 0));
  const byFormat = group<Format>(posts, (p) => p.format, (k) => FORMAT_LABEL[k]);
  const byHour = group<string>(posts, (p) => (p.post_hour_et == null ? null : String(p.post_hour_et)), hourLabel);

  // Hashtags that show up most in the top quartile by velocity vs the rest.
  const sorted = [...posts].filter((p) => p.velocity != null).sort((a, b) => (b.velocity ?? 0) - (a.velocity ?? 0));
  const top = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 4)));
  const freq = (ps: AnalyzedPost[]) => { const m = new Map<string, number>(); for (const p of ps) for (const t of p.hashtags) m.set(t, (m.get(t) ?? 0) + 1); return m; };
  const topF = freq(top), allF = freq(sorted);
  const hashtags = Array.from(topF.entries()).map(([tag, n]) => ({ tag, inTop: n, inAll: allF.get(tag) ?? n, topShare: Math.round((n / top.length) * 100) })).sort((a, b) => b.inTop - a.inTop).slice(0, 15);

  const keywords = new Map<string, { n: number; comments: number[] }>();
  for (const p of posts) if (p.cta_keyword) { const k = keywords.get(p.cta_keyword) ?? { n: 0, comments: [] }; k.n++; k.comments.push(p.comments_count ?? 0); keywords.set(p.cta_keyword, k); }
  const ctaKeywords = Array.from(keywords.entries()).map(([keyword, v]) => ({ keyword, n: v.n, medianComments: median(v.comments) })).sort((a, b) => (b.medianComments ?? 0) - (a.medianComments ?? 0)).slice(0, 10);

  const bestHook = byHook.find((g) => g.enough), bestCta = byCta.find((g) => g.enough && g.key !== "none"), bestHour = byHour.find((g) => g.enough);
  const testable: TestableVariable[] = [
    { key: "hook_text", label: "Hook text (first line / on-screen text)", measurable: true, evidence: bestHook ? `${bestHook.label} hooks run at ${bestHook.lift ?? "?"}× median velocity (n=${bestHook.n}).` : "Not enough posts per hook type yet.", suggestion: "Post the same clip with 2–3 different hooks; keep everything else identical." },
    { key: "cta_keyword", label: "Caption CTA keyword", measurable: true, evidence: bestCta ? `${bestCta.label} posts get a median ${bestCta.medianComments ?? "?"} comments (n=${bestCta.n}).` : "Not enough CTA examples yet.", suggestion: "Rotate the comment keyword (e.g. AI vs PROMPT vs BUILD) and compare comment counts." },
    { key: "hashtags", label: "Hashtags", measurable: true, evidence: hashtags[0] ? `#${hashtags[0].tag} appears on ${hashtags[0].topShare}% of the top-quartile posts.` : "No hashtag data yet.", suggestion: "Test a top-quartile hashtag set against your usual set." },
    { key: "thumbnail_frame", label: "Thumbnail / cover frame", measurable: false, evidence: "The API doesn't expose which cover was chosen — compare by eye from the post previews.", suggestion: "Test a face-forward frame against a text-on-screen frame." },
    { key: "post_time", label: "Post time", measurable: true, evidence: bestHour ? `Posts at ${bestHour.label} run at ${bestHour.lift ?? "?"}× median velocity (n=${bestHour.n}).` : "Not enough posts per hour yet.", suggestion: "Post the next variant test at the best hour and the next one off-peak." },
  ];
  return { total: posts.length, byHook, byCta, byFormat, byHour, hashtags, ctaKeywords, testable, overallMedianVelocity: median(posts.map((p) => p.velocity ?? NaN)) };
}

/** Rome's packaging principle, shown at the top of the analyzer. Source: Rome's own review of @angus.sewell (not independently verified by the lab). */
export const PACKAGING_PRINCIPLE = "Same video, different packaging: identical clips on @angus.sewell ranged from 23 to 11,865 likes on hook, caption and cover alone. Test the packaging before you make a new video.";
