// SFB Connect — Live Business Lookup edge function.
//
// Given a business website / social profile URL (and optional city/state),
// this fetches the PUBLIC page server-side, extracts real signals (title,
// meta description, JSON-LD schema.org data, phone, social links, https),
// and computes a transparent, rule-based "SFB Connect AI Presence Preview"
// score. No LLM is used and nothing is invented — every field returned is
// either evidence-backed or explicitly marked not_found / uncertain.
//
// This does NOT search the web for a business by name alone (that needs a
// search-provider API key that isn't configured yet) — if the visitor only
// gives a business name with no link, we return status "needs_link" and ask
// for a website or social profile URL instead of guessing.

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type VerifiedField<T> = {
  value: T | null;
  status: "confirmed" | "uncertain" | "not_found";
  confidence: number;
  sources: string[];
};

const SOCIAL_HOSTS = [
  "instagram.com",
  "facebook.com",
  "tiktok.com",
  "linkedin.com",
  "x.com",
  "twitter.com",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const looksLikeUrl =
    /^https?:\/\//i.test(trimmed) ||
    /^(www\.)?[a-z0-9-]+\.[a-z]{2,}(\/|$)/i.test(trimmed) ||
    SOCIAL_HOSTS.some((h) => trimmed.toLowerCase().includes(h));
  if (!looksLikeUrl) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function extract(regex: RegExp, html: string): string | null {
  const m = html.match(regex);
  return m ? m[1].trim() : null;
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function parseJsonLd(html: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch {
      // ignore malformed JSON-LD, never invent a substitute
    }
  }
  return blocks;
}

function findSocialLinks(html: string): { platform: string; url: string }[] {
  const found: { platform: string; url: string }[] = [];
  const re = /href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(html))) {
    const href = m[1];
    for (const host of SOCIAL_HOSTS) {
      if (href.includes(host) && !seen.has(host)) {
        seen.add(host);
        found.push({ platform: host.split(".")[0], url: href });
      }
    }
  }
  return found;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { query?: string; location?: string };
  try {
    body = await req.json();
  } catch {
    return json({ status: "failed", message: "Invalid request." }, 400);
  }

  const rawQuery = (body.query || "").trim();
  const location = (body.location || "").trim() || null;

  if (!rawQuery) {
    return json({ status: "failed", message: "Enter a business, website, or social profile." }, 400);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase =
    SUPABASE_URL && SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY) : null;

  // Lightweight abuse protection: hash the caller IP and cap lookups/hour.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipHash = await crypto.subtle
    .digest("SHA-256", new TextEncoder().encode(ip))
    .then((buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join(""));

  if (supabase) {
    const { count } = await supabase
      .from("business_lookup_jobs")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if ((count ?? 0) >= 12) {
      return json(
        { status: "failed", message: "Too many lookups. Please try again in a bit." },
        429
      );
    }
  }

  const jobRow = supabase
    ? await supabase
        .from("business_lookup_jobs")
        .insert({ query: rawQuery, location, status: "researching", ip_hash: ipHash })
        .select("id")
        .single()
    : { data: null };
  const jobId = jobRow?.data?.id ?? crypto.randomUUID();

  const targetUrl = normalizeUrl(rawQuery);

  if (!targetUrl) {
    if (supabase) {
      await supabase
        .from("business_lookup_jobs")
        .update({ status: "needs_link", completed_at: new Date().toISOString() })
        .eq("id", jobId);
    }
    return json({
      jobId,
      status: "needs_link",
      message:
        "We can't search the web by business name alone yet. Paste your website, Instagram, Facebook, TikTok, or Google Business link instead.",
    });
  }

  let html = "";
  let fetchedUrl = targetUrl;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(targetUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SFBConnectBot/1.0; +https://sfbconnect.com) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);
    fetchedUrl = res.url || targetUrl;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch {
    if (supabase) {
      await supabase
        .from("business_lookup_jobs")
        .update({ status: "failed", completed_at: new Date().toISOString() })
        .eq("id", jobId);
    }
    return json({
      jobId,
      status: "failed",
      message: "We couldn't confidently access that link. Check the URL and try again.",
    });
  }

  // ---- Evidence extraction (public page content only) ----
  const title = extract(/<title[^>]*>([^<]*)<\/title>/i, html);
  const metaDescription =
    extract(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i, html) ||
    extract(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i, html);
  const ogTitle =
    extract(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i, html) ||
    extract(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i, html);
  const jsonLd = parseJsonLd(html);
  const localBusiness = jsonLd.find((b) => {
    const type = b["@type"];
    const t = Array.isArray(type) ? type.join(",") : String(type || "");
    return /LocalBusiness|Organization|Restaurant|Store|ProfessionalService/i.test(t);
  });

  const phoneMatch = html.match(/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/);
  const socialLinks = findSocialLinks(html);
  const isHttps = fetchedUrl.startsWith("https://");
  const hasAggregateRating = jsonLd.some((b) => !!b["aggregateRating"]);

  const schemaName = localBusiness ? String(localBusiness["name"] || "") : null;
  const schemaAddress = localBusiness ? (localBusiness["address"] as Record<string, unknown> | undefined) : undefined;
  const schemaPhone = localBusiness ? String(localBusiness["telephone"] || "") : null;

  const nameCandidates = [schemaName, ogTitle, title].filter(Boolean) as string[];
  const businessName = nameCandidates[0]
    ? decodeEntities(nameCandidates[0].split(/[|–—-]/)[0])
    : null;

  const name: VerifiedField<string> = businessName
    ? {
        value: businessName,
        status: nameCandidates.length >= 2 ? "confirmed" : "uncertain",
        confidence: nameCandidates.length >= 2 ? 0.9 : 0.55,
        sources: [fetchedUrl],
      }
    : { value: null, status: "not_found", confidence: 0, sources: [] };

  const website: VerifiedField<string> = {
    value: fetchedUrl,
    status: "confirmed",
    confidence: 1,
    sources: [fetchedUrl],
  };

  const phoneValue = schemaPhone || phoneMatch?.[0] || null;
  const phone: VerifiedField<string> = phoneValue
    ? { value: phoneValue, status: schemaPhone ? "confirmed" : "uncertain", confidence: schemaPhone ? 0.9 : 0.6, sources: [fetchedUrl] }
    : { value: null, status: "not_found", confidence: 0, sources: [] };

  let locationValue: string | null = null;
  if (schemaAddress) {
    const parts = [schemaAddress["addressLocality"], schemaAddress["addressRegion"]]
      .filter(Boolean)
      .join(", ");
    locationValue = parts || null;
  }
  const locationConfirmed = !!locationValue;
  const locationMentioned =
    !locationConfirmed && location ? html.toLowerCase().includes(location.toLowerCase()) : false;
  const locationField: VerifiedField<string> = locationConfirmed
    ? { value: locationValue, status: "confirmed", confidence: 0.9, sources: [fetchedUrl] }
    : locationMentioned
    ? { value: location, status: "uncertain", confidence: 0.5, sources: [fetchedUrl] }
    : { value: null, status: "not_found", confidence: 0, sources: [] };

  const categoryValue = localBusiness ? (Array.isArray(localBusiness["@type"]) ? localBusiness["@type"][0] : localBusiness["@type"]) : null;
  const category: VerifiedField<string> = categoryValue
    ? { value: String(categoryValue), status: "confirmed", confidence: 0.7, sources: [fetchedUrl] }
    : { value: null, status: "not_found", confidence: 0, sources: [] };

  // ---- Deterministic scoring (0-20 each, sums to overall 0-100) ----
  const identityScore = name.status === "confirmed" ? 20 : name.status === "uncertain" ? 10 : 0;
  const knowledgeScore = (metaDescription ? 10 : 0) + (localBusiness ? 10 : 0);
  const authorityScore = (socialLinks.length > 0 ? 10 : 0) + (hasAggregateRating ? 10 : 0);
  const locationScore = locationField.status === "confirmed" ? 20 : locationField.status === "uncertain" ? 10 : 0;
  const machineReadabilityScore = (isHttps ? 10 : 0) + (jsonLd.length > 0 ? 10 : 0);
  const overall = identityScore + knowledgeScore + authorityScore + locationScore + machineReadabilityScore;

  const strengths: string[] = [];
  const gaps: string[] = [];
  const missing: string[] = [];

  if (identityScore >= 15) strengths.push("Business name is clear and consistent");
  else if (identityScore > 0) gaps.push("Business name isn't consistent across the page");
  else missing.push("No clear business name found");

  if (localBusiness) strengths.push("Structured business data (schema.org) found");
  else missing.push("No structured business data (schema.org) found");

  if (metaDescription) strengths.push("Meta description clearly explains the business");
  else gaps.push("No meta description found");

  if (socialLinks.length > 0) strengths.push(`Linked to ${socialLinks.length} social profile${socialLinks.length > 1 ? "s" : ""}`);
  else gaps.push("No linked social profiles found");

  if (!hasAggregateRating) missing.push("No review/rating data found");

  if (locationField.status === "confirmed") strengths.push("Location clearly stated in structured data");
  else if (locationField.status === "uncertain") gaps.push("Location mentioned but not structured");
  else missing.push("No location found");

  if (isHttps) strengths.push("Site is served over HTTPS");
  else missing.push("Site is not served over HTTPS");

  const sources = ["website", ...socialLinks.map((s) => s.platform)];

  const result = {
    business: { name, website, phone, location: locationField, category },
    scores: {
      overall,
      identity: identityScore,
      knowledge: knowledgeScore,
      authority: authorityScore,
      location: locationScore,
      machineReadability: machineReadabilityScore,
    },
    strengths: strengths.slice(0, 3),
    gaps: gaps.slice(0, 3),
    missing,
    sources,
  };

  if (supabase) {
    await supabase
      .from("business_lookup_jobs")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", jobId);
    await supabase.from("business_lookup_results").insert({
      job_id: jobId,
      business_name: name.value,
      website: website.value,
      phone: phone.value,
      location: locationField.value,
      category: category.value,
      overall_score: overall,
      identity_score: identityScore,
      knowledge_score: knowledgeScore,
      authority_score: authorityScore,
      location_score: locationScore,
      machine_readability_score: machineReadabilityScore,
      strengths: result.strengths,
      gaps: result.gaps,
      missing: result.missing,
      sources,
      raw_verified_data: result,
    });
  }

  return json({ jobId, status: "completed", result });
});
