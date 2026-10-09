import type { FeedSource, FeedTarget, RawFinding } from "../types";
import { logSearchCall } from "../../usage";

/**
 * Exa semantic search as a prospect source. Uses the "company" category so
 * results are business homepages, not articles. One or two queries per
 * target per run (cost-bounded: the budget table prices a search at ~$0.007).
 *
 * Reads EXA_API_KEY — the same key the existing discovery provider uses.
 */
type ExaResult = { title?: string | null; url: string; text?: string | null; publishedDate?: string | null; summary?: string | null };

export const defaultQueries = (t: FeedTarget): string[] =>
  t.queries && t.queries.length
    ? t.queries
    : [`${t.vertical} company in ${t.city}, ${t.state}`, `locally owned ${t.vertical} contractor ${t.city} ${t.state}`];

export function exaFeedSource(opts: { apiKey?: string | null; fetchImpl?: typeof fetch; log?: boolean } = {}): FeedSource {
  const apiKey = opts.apiKey === undefined ? process.env.EXA_API_KEY ?? null : opts.apiKey;
  const f = opts.fetchImpl ?? fetch;
  const log = opts.log ?? true;
  return {
    kind: "exa",
    isConfigured: () => !!apiKey,
    async pull(target, { limit, signal }) {
      if (!apiKey) return [];
      const out: RawFinding[] = [];
      const perQuery = Math.max(3, Math.ceil(limit / Math.max(1, defaultQueries(target).length)));
      for (const query of defaultQueries(target)) {
        if (signal?.aborted) break;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 9000);
        const onAbort = () => ctrl.abort();
        signal?.addEventListener("abort", onAbort, { once: true });
        try {
          const res = await f("https://api.exa.ai/search", {
            method: "POST",
            headers: { "content-type": "application/json", "x-api-key": apiKey },
            body: JSON.stringify({ query, numResults: perQuery, type: "auto", category: "company", contents: { text: { maxCharacters: 500 } } }),
            signal: ctrl.signal,
          });
          if (log) void logSearchCall("exa", query);
          if (!res.ok) continue;
          const j = (await res.json()) as { results?: ExaResult[] };
          for (const r of j.results ?? []) {
            if (!r.url) continue;
            out.push({
              sourceKind: "exa",
              sourceUrl: `https://exa.ai/search?q=${encodeURIComponent(query)}`,
              title: (r.title ?? "").trim(),
              snippet: (r.text ?? r.summary ?? "").replace(/\s+/g, " ").trim(),
              url: r.url,
              publishedAt: r.publishedDate ?? null,
              targetId: target.id,
            });
          }
        } catch {
          // provider failure → no findings from this query; the run records nothing for it
        } finally {
          clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
        }
      }
      return out.slice(0, limit);
    },
  };
}
