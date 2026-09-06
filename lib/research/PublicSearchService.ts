// Phase 8 (broad public search expansion) requires a real search API — this
// is NOT available by default. If EXA_API_KEY is configured (a single
// server-side secret from exa.ai — no OAuth needed), this queries Exa's
// search API directly. If it's not configured, every call below returns an
// empty result set rather than fabricating search hits or silently reusing
// crawl data as if it were a broader search.

export type SearchResult = { title: string; url: string; snippet: string };

export function isPublicSearchConfigured(): boolean {
  return !!process.env.EXA_API_KEY;
}

export async function publicSearch(query: string, numResults = 5): Promise<SearchResult[]> {
  const key = process.env.EXA_API_KEY;
  if (!key) return [];

  try {
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify({ query, numResults, type: "auto", contents: { text: { maxCharacters: 300 } } }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((r: any) => ({ title: r.title || "", url: r.url, snippet: r.text || "" }));
  } catch {
    return [];
  }
}
