// Builds a lightweight identity fingerprint from what's already been
// confirmed via direct crawling (never from search results themselves), and
// uses it to decide whether a broad-search hit plausibly belongs to the same
// business. This is the guard against the "merged two different businesses
// because the names looked similar" failure mode.

export type IdentityFingerprint = {
  name: string | null;
  domain: string | null;
  phoneDigits: string | null;
};

export function buildFingerprint(params: { name: string | null; domain: string | null; phone: string | null }): IdentityFingerprint {
  return {
    name: params.name ? params.name.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim() : null,
    domain: params.domain ? params.domain.toLowerCase() : null,
    phoneDigits: params.phone ? params.phone.replace(/\D/g, "") : null,
  };
}

function nameSimilar(a: string, b: string): boolean {
  const wordsA = new Set(a.split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(b.split(/\s+/).filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  return overlap / Math.min(wordsA.size, wordsB.size) >= 0.6;
}

/** Does a candidate fact (with its own text/domain/phone) plausibly belong to this fingerprint? */
export function matchesFingerprint(fp: IdentityFingerprint, candidate: { text?: string; domain?: string; phone?: string }): boolean {
  if (candidate.domain && fp.domain && candidate.domain.toLowerCase() === fp.domain) return true;
  if (candidate.phone && fp.phoneDigits && candidate.phone.replace(/\D/g, "").endsWith(fp.phoneDigits.slice(-10))) return true;
  if (candidate.text && fp.name) return nameSimilar(fp.name, candidate.text.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim());
  return false;
}
