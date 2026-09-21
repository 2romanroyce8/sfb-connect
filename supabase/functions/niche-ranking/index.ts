// SFB Connect — Niche Ranking edge function.
//
// Given a business's ALREADY-VERIFIED category (a schema.org business
// subtype straight from their own structured data) and location, this
// searches the public web for that niche + location and builds a top-5
// "AI Discovery Market Position" from real search results. It never
// invents a ranking: if the category isn't specific enough, the location
// isn't known, the search provider isn't configured, or too few real
// businesses can be identified, it says so honestly instead of guessing.
// There is no LLM call and no exact rank is ever reported beyond a
// verified top-five position -- a business found outside that window is
// reported as "outside verified top 5", never as an invented #6/#12/#37.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// schema.org base types that are too generic to build a fair niche
// comparison from -- if this is all the earlier lookup found, we say so
// honestly instead of guessing at a specific trade/vertical.
const GENERIC_TYPES = new Set([
  "localbusiness",
  "organization",
  "professionalservice",
  "store",
  "place",
  "thing",
]);

function humanizeSchemaType(type: string): string {
  // "RoofingContractor" -> "Roofing Contractor"
  return type
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim();
}

const DIRECTORY_HOSTS = [
  "yelp.com", "angi.com", "thumbtack.com", "homeadvisor.com", "yellowpages.com", "bbb.org",
  "mapquest.com", "facebook.com", "instagram.com", "linkedin.com", "indeed.com", "glassdoor.com",
  "wikipedia.org", "reddit.com", "youtube.com", "tripadvisor.com", "nextdoor.com", "porch.com",
  "houzz.com", "google.com", "x.com", "twitter.com", "tiktok.com", "pinterest.com", "yelp.co.uk",
  "expertise.com", "clutch.co",
];

function domainOf(rawUrl: string): string | null {
  try {
    const u = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function cleanTitle(title: string): string {
  return title.split(/[|–—-]/)[0].trim();
}

type RankingCandidate = {
  rank: number;
  name: string;
  domain: string;
  url: string;
  reason: string;
  isYourBusiness: boolean;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: {
    category?: string | null;
    location?: string | null;
    businessName?: string | null;
    businessWebsite?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return json({ status: "failed", message: "Invalid request." }, 400);
  }

  const rawCategory = (body.category || "").trim();
  const location = (body.location || "").trim();
  const businessName = (body.businessName || "").trim() || null;
  const businessWebsite = (body.businessWebsite || "").trim() || null;
  const businessDomain = businessWebsite ? domainOf(businessWebsite) : null;

  if (!location) {
    return json({
      status: "insufficient_evidence",
      message:
        "We couldn't confidently determine your business's location, so we can't build a fair market comparison yet.",
    });
  }
  if (!rawCategory || GENERIC_TYPES.has(rawCategory.toLowerCase())) {
    return json({
      status: "insufficient_evidence",
      message:
        "We couldn't confidently determine your specific business category from public data, so we can't build a fair market comparison yet.",
    });
  }

  const niche = humanizeSchemaType(rawCategory);

  const EXA_API_KEY = Deno.env.get("EXA_API_KEY");
  if (!EXA_API_KEY) {
    return json({
      status: "unavailable",
      message: "Market comparison isn't available right now.",
      niche,
      geography: location,
    });
  }

  let searchResults: { title: string; url: string; snippet: string }[] = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": EXA_API_KEY },
      body: JSON.stringify({
        query: `best ${niche} in ${location}`,
        numResults: 12,
        type: "auto",
        contents: { text: { maxCharacters: 280 } },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      searchResults = (data.results || []).map((r: any) => ({
        title: r.title || "",
        url: r.url,
        snippet: r.text || "",
      }));
    }
  } catch {
    // Fall through with an empty result set -- handled honestly below as
    // insufficient evidence rather than throwing a generic error.
  }

  // Build candidate businesses in the exact order search actually returned
  // them (that order IS the evidence) -- skip directories/aggregators and
  // duplicate domains, and never fetch beyond the top 5 real businesses.
  const seen = new Set<string>();
  const candidates: Omit<RankingCandidate, "isYourBusiness">[] = [];

  for (const r of searchResults) {
    if (candidates.length >= 5) break;
    const domain = domainOf(r.url);
    if (!domain) continue;
    if (DIRECTORY_HOSTS.some((h) => domain === h || domain.endsWith(`.${h}`))) continue;
    if (seen.has(domain)) continue;
    seen.add(domain);
    candidates.push({
      rank: candidates.length + 1,
      name: cleanTitle(r.title) || domain,
      domain,
      url: r.url,
      reason: r.snippet ? r.snippet.slice(0, 160) : `Appears in public search results for "${niche} in ${location}".`,
    });
  }

  if (candidates.length === 0) {
    return json({
      status: "insufficient_evidence",
      niche,
      geography: location,
      message: `We couldn't confidently identify enough businesses to build a verified top-five comparison for ${niche} in ${location}.`,
    });
  }

  const matchedCandidate = businessDomain ? candidates.find((c) => c.domain === businessDomain) : undefined;

  let yourBusiness: {
    inTopFive: boolean;
    rank: number | null;
    status: "top5" | "outside" | "unverified";
    note: string;
  };

  if (!businessDomain) {
    yourBusiness = {
      inTopFive: false,
      rank: null,
      status: "unverified",
      note: "We couldn't verify a website for your business, so we can't check its position.",
    };
  } else if (matchedCandidate) {
    yourBusiness = {
      inTopFive: true,
      rank: matchedCandidate.rank,
      status: "top5",
      note: `Your business appears at #${matchedCandidate.rank} in the verified top five we found for ${niche} in ${location}.`,
    };
  } else {
    // Never invent #6, #12, #37, etc. -- if it's not confirmed in the
    // verified top five, it's honestly "outside", with no fabricated
    // precision beyond that.
    yourBusiness = {
      inTopFive: false,
      rank: null,
      status: "outside",
      note: `Your business did not appear in the verified top five we found for ${niche} in ${location}.`,
    };
  }

  // Confidence reflects what this evidence actually is: search-relevance
  // signals, not a deep multi-signal audit of every candidate site.
  const confidence: "HIGH" | "MEDIUM" | "LOW" = candidates.length >= 4 ? "MEDIUM" : "LOW";

  const topFive: RankingCandidate[] = candidates.map((c) => ({
    ...c,
    isYourBusiness: businessDomain ? c.domain === businessDomain : false,
  }));

  return json({
    status: "completed",
    niche,
    geography: location,
    confidence,
    analyzedAt: new Date().toISOString(),
    topFive,
    yourBusiness,
  });
});
