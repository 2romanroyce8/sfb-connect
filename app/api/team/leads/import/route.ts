import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

// ============================================================
// SFB Sales OS — Lead Research Pipeline (Phases 5-7)
//
// Real, server-side, evidence-based research across every source URL the
// rep supplies. No LLM call anywhere in this file — every field is either
// extracted from a fetched public page or marked not_found/uncertain.
// Social platforms that require login/JS to render (Instagram, TikTok, most
// Facebook pages) will usually fail a plain fetch; when that happens the
// source is recorded as SOURCE UNAVAILABLE and research continues with
// whatever else was supplied, per the no-fake-scraping requirement.
// ============================================================

type Candidate = { value: string; sourceUrl: string; sourceType: string; strength: number };

const SOCIAL_HOSTS = ["instagram.com", "facebook.com", "tiktok.com", "linkedin.com", "x.com", "twitter.com"];

function classifySourceType(url: string): string {
  const host = url.toLowerCase();
  for (const h of SOCIAL_HOSTS) if (host.includes(h)) return h.split(".")[0];
  if (host.includes("google.com/maps") || host.includes("g.page")) return "google_business";
  return "website";
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
      // malformed JSON-LD — never substitute a guess
    }
  }
  return blocks;
}

async function fetchSource(url: string): Promise<{ ok: boolean; html: string; finalUrl: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SFBSalesOSBot/1.0; +https://sfbconnect.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return { ok: false, html: "", finalUrl: url };
    const html = await res.text();
    return { ok: true, html, finalUrl: res.url || url };
  } catch {
    return { ok: false, html: "", finalUrl: url };
  }
}

function normalizeUrl(input: string): string {
  const t = input.trim();
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  if (!caller?.team_role) {
    return NextResponse.json({ error: "Team access required." }, { status: 403 });
  }

  const body = await req.json();
  const rawSources: string[] = (body.sources || []).filter((s: string) => s && s.trim());
  const location: string | undefined = body.location;
  const assignedRep: string | undefined = body.assignedRep;

  if (rawSources.length === 0) {
    return NextResponse.json({ error: "At least one source URL is required." }, { status: 400 });
  }

  const service = createSupabaseServiceClient();
  const sources = rawSources.map(normalizeUrl);

  // ---- Create the lead + research job shell ----
  const { data: lead, error: leadError } = await service
    .from("crm_leads")
    .insert({
      source_urls: sources,
      pipeline_stage: "researching",
      assigned_rep: assignedRep || null,
      created_by: user.id,
      city: location?.split(",")[0]?.trim() || null,
      state: location?.split(",")[1]?.trim() || null,
    })
    .select("id")
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: leadError?.message || "Could not create lead." }, { status: 400 });
  }

  const { data: job } = await service
    .from("crm_research_jobs")
    .insert({ lead_id: lead.id, status: "running", current_step: "Source extraction", started_by: user.id })
    .select("id")
    .single();

  await service.from("crm_activities").insert({
    lead_id: lead.id,
    rep_id: user.id,
    activity_type: "lead_imported",
    description: `Lead research started from ${sources.length} source(s)`,
  });

  // ---- STAGE 1-2: fetch + extract each source ----
  const fetched: { url: string; type: string; ok: boolean; html: string; finalUrl: string }[] = [];
  for (const url of sources) {
    const type = classifySourceType(url);
    const result = await fetchSource(url);
    fetched.push({ url, type, ...result });
    await service.from("crm_lead_evidence").insert({
      lead_id: lead.id,
      field_name: "source_status",
      field_value: result.ok ? "accessible" : "unavailable",
      status: result.ok ? "verified" : "not_found",
      confidence: result.ok ? 1 : 0,
      source_url: url,
      source_type: type,
      research_pass: 1,
    });
  }

  if (job) await service.from("crm_research_jobs").update({ current_step: "Cross-source discovery" }).eq("id", job.id);

  const accessible = fetched.filter((f) => f.ok);

  // ---- STAGE 3-5: extract candidates per accessible source ----
  const nameCandidates: Candidate[] = [];
  const phoneCandidates: Candidate[] = [];
  const websiteCandidates: Candidate[] = [];
  const categoryCandidates: Candidate[] = [];
  const locationCandidates: Candidate[] = [];
  const socialLinks: { platform: string; url: string }[] = [];
  let hasJsonLd = false;
  let hasAggregateRating = false;
  let hasHttps = false;
  let hasMetaDescription = false;

  for (const src of accessible) {
    const { html, finalUrl, type } = src;
    const title = extract(/<title[^>]*>([^<]*)<\/title>/i, html);
    const ogTitle =
      extract(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i, html) ||
      extract(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i, html);
    const metaDescription = extract(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
      html
    );
    if (metaDescription) hasMetaDescription = true;
    if (finalUrl.startsWith("https://")) hasHttps = true;

    const jsonLd = parseJsonLd(html);
    const localBusiness = jsonLd.find((b) => {
      const t = Array.isArray(b["@type"]) ? b["@type"].join(",") : String(b["@type"] || "");
      return /LocalBusiness|Organization|Restaurant|Store|ProfessionalService/i.test(t);
    });
    if (jsonLd.length > 0) hasJsonLd = true;
    if (jsonLd.some((b) => !!b["aggregateRating"])) hasAggregateRating = true;

    if (localBusiness?.name) {
      nameCandidates.push({ value: decodeEntities(String(localBusiness.name)), sourceUrl: finalUrl, sourceType: type, strength: 3 });
    }
    if (ogTitle) nameCandidates.push({ value: decodeEntities(ogTitle.split(/[|–—-]/)[0]), sourceUrl: finalUrl, sourceType: type, strength: 2 });
    if (title) nameCandidates.push({ value: decodeEntities(title.split(/[|–—-]/)[0]), sourceUrl: finalUrl, sourceType: type, strength: 1 });

    const schemaPhone = localBusiness?.telephone ? String(localBusiness.telephone) : null;
    const phoneMatch = html.match(/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/);
    if (schemaPhone) phoneCandidates.push({ value: schemaPhone, sourceUrl: finalUrl, sourceType: type, strength: 3 });
    else if (phoneMatch) phoneCandidates.push({ value: phoneMatch[0], sourceUrl: finalUrl, sourceType: type, strength: 1 });

    if (type === "website") websiteCandidates.push({ value: finalUrl, sourceUrl: finalUrl, sourceType: type, strength: 3 });

    const schemaType = localBusiness?.["@type"];
    if (schemaType) {
      categoryCandidates.push({
        value: String(Array.isArray(schemaType) ? schemaType[0] : schemaType),
        sourceUrl: finalUrl,
        sourceType: type,
        strength: 2,
      });
    }

    const address = localBusiness?.address as Record<string, unknown> | undefined;
    if (address) {
      const parts = [address["addressLocality"], address["addressRegion"]].filter(Boolean).join(", ");
      if (parts) locationCandidates.push({ value: parts, sourceUrl: finalUrl, sourceType: type, strength: 3 });
    }

    const linkRe = /href=["']([^"']+)["']/gi;
    let m: RegExpExecArray | null;
    const seen = new Set<string>();
    while ((m = linkRe.exec(html))) {
      for (const host of SOCIAL_HOSTS) {
        if (m[1].includes(host) && !seen.has(host)) {
          seen.add(host);
          socialLinks.push({ platform: host.split(".")[0], url: m[1] });
        }
      }
    }
  }

  if (job) await service.from("crm_research_jobs").update({ current_step: "Contact verification" }).eq("id", job.id);

  // ---- STAGE 6-8: resolve each field to a final verified/uncertain/not_found/conflict value ----
  function resolve(candidates: Candidate[]) {
    if (candidates.length === 0) return { value: null, status: "not_found" as const, confidence: 0, sources: [] as string[] };
    const distinctValues = Array.from(new Set(candidates.map((c) => c.value.toLowerCase())));
    const bySources = new Set(candidates.map((c) => c.sourceUrl));
    const best = [...candidates].sort((a, b) => b.strength - a.strength)[0];
    if (distinctValues.length > 1 && bySources.size > 1) {
      // Multiple independent sources disagree
      const conflicting = distinctValues.length > 1 && candidates.some((c) => c.strength >= 2);
      if (conflicting) {
        return {
          value: best.value,
          status: "conflict" as const,
          confidence: 0.4,
          sources: candidates.map((c) => c.sourceUrl),
        };
      }
    }
    const agreeingSources = new Set(
      candidates.filter((c) => c.value.toLowerCase() === best.value.toLowerCase()).map((c) => c.sourceUrl)
    );
    if (best.strength >= 3 || agreeingSources.size > 1) {
      return { value: best.value, status: "verified" as const, confidence: 0.9, sources: Array.from(agreeingSources) };
    }
    return { value: best.value, status: "uncertain" as const, confidence: 0.5, sources: Array.from(agreeingSources) };
  }

  const name = resolve(nameCandidates);
  const phone = resolve(phoneCandidates);
  const website = resolve(websiteCandidates);
  const category = resolve(categoryCandidates);
  const location_ = resolve(locationCandidates);

  const fieldsToRecord = [
    { field: "business_name", ...name },
    { field: "phone", ...phone },
    { field: "website", ...website },
    { field: "category", ...category },
    { field: "location", ...location_ },
  ];

  for (const f of fieldsToRecord) {
    for (const src of f.sources.length > 0 ? f.sources : [null]) {
      await service.from("crm_lead_evidence").insert({
        lead_id: lead.id,
        field_name: f.field,
        field_value: f.value,
        status: f.status,
        confidence: f.confidence,
        source_url: src,
        source_type: src ? classifySourceType(src) : null,
        research_pass: 8,
      });
    }
  }

  // Signal-level evidence — persisted so a later AI Presence Audit can explain
  // its category scores from stored evidence alone, without re-fetching any
  // source. Each row traces back to whether we actually saw it in the HTML.
  const signalEvidence: { field: string; value: string; status: "verified" | "not_found" }[] = [
    { field: "structured_data", value: hasJsonLd ? "present" : "absent", status: hasJsonLd ? "verified" : "not_found" },
    { field: "https", value: hasHttps ? "yes" : "no", status: hasHttps ? "verified" : "not_found" },
    { field: "meta_description", value: hasMetaDescription ? "present" : "absent", status: hasMetaDescription ? "verified" : "not_found" },
    { field: "aggregate_rating", value: hasAggregateRating ? "present" : "absent", status: hasAggregateRating ? "verified" : "not_found" },
    {
      field: "social_profiles",
      value: socialLinks.length > 0 ? socialLinks.map((s) => s.platform).join(",") : "none",
      status: socialLinks.length > 0 ? "verified" : "not_found",
    },
  ];
  for (const s of signalEvidence) {
    await service.from("crm_lead_evidence").insert({
      lead_id: lead.id,
      field_name: s.field,
      field_value: s.value,
      status: s.status,
      confidence: s.status === "verified" ? 1 : 0,
      source_url: accessible[0]?.finalUrl || null,
      source_type: "website",
      research_pass: 8,
    });
  }

  // ---- Deterministic AI Presence audit (same 5-category framework as the public site) ----
  const identityScore = name.status === "verified" ? 20 : name.status === "uncertain" ? 10 : 0;
  const knowledgeScore = (hasMetaDescription ? 10 : 0) + (hasJsonLd ? 10 : 0);
  const authorityScore = (socialLinks.length > 0 ? 10 : 0) + (hasAggregateRating ? 10 : 0);
  const locationScore = location_.status === "verified" ? 20 : location_.status === "uncertain" ? 10 : 0;
  const machineReadabilityScore = (hasHttps ? 10 : 0) + (hasJsonLd ? 10 : 0);
  const overall = identityScore + knowledgeScore + authorityScore + locationScore + machineReadabilityScore;

  const strengths: string[] = [];
  const middlePoints: string[] = [];
  const weaknesses: string[] = [];
  const unknowns: string[] = [];

  if (identityScore >= 15) strengths.push("Business identity is clear and consistent across sources");
  else if (identityScore > 0) middlePoints.push("Business name found but not consistently confirmed");
  else unknowns.push("Could not confirm business name");

  if (hasJsonLd) strengths.push("Structured business data (schema.org) found");
  else weaknesses.push("No structured business data found");

  if (phone.status === "verified") strengths.push("Phone number verified across sources");
  else if (phone.status === "conflict") weaknesses.push("Phone number conflicts between sources");
  else if (phone.status === "uncertain") middlePoints.push("Phone number found but only from one source");
  else unknowns.push("No phone number found");

  if (socialLinks.length > 0) strengths.push(`Linked to ${socialLinks.length} social profile(s)`);
  else middlePoints.push("No linked social profiles found");

  if (location_.status !== "verified") unknowns.push("Location not confirmed from structured data");

  const offer =
    overall < 40
      ? "ai_presence"
      : identityScore < 10
      ? "website_new"
      : machineReadabilityScore < 10
      ? "website_rebuild"
      : overall < 70
      ? "ai_presence"
      : "bingled";

  await service.from("crm_audits").insert({
    lead_id: lead.id,
    overall_score: overall,
    identity_score: identityScore,
    knowledge_score: knowledgeScore,
    authority_score: authorityScore,
    location_score: locationScore,
    machine_readability_score: machineReadabilityScore,
    summary: `${name.value || "This business"} has ${accessible.length} of ${sources.length} supplied source(s) publicly accessible for research.`,
    strengths,
    middle_points: middlePoints,
    weaknesses,
    unknowns,
  });

  await service.from("crm_opportunities").insert({
    lead_id: lead.id,
    primary_offer: offer,
    reasoning: `Based on an overall AI Presence score of ${overall}/100 (Identity ${identityScore}, Knowledge ${knowledgeScore}, Authority ${authorityScore}, Location ${locationScore}, Machine Readability ${machineReadabilityScore}).`,
  });

  const readyToCall = phone.status === "verified" || phone.status === "uncertain" || website.status === "verified";

  await service
    .from("crm_leads")
    .update({
      business_name: name.value,
      phone: phone.value,
      website: website.value,
      category: category.value,
      ai_overall_score: overall,
      recommended_offer: offer,
      pipeline_stage: readyToCall ? "ready_to_call" : "researching",
      updated_at: new Date().toISOString(),
    })
    .eq("id", lead.id);

  if (job) {
    await service
      .from("crm_research_jobs")
      .update({ status: "completed", current_step: "Complete", completed_at: new Date().toISOString() })
      .eq("id", job.id);
  }

  await service.from("crm_activities").insert({
    lead_id: lead.id,
    rep_id: user.id,
    activity_type: "research_completed",
    description: `Research complete — AI Presence ${overall}/100, recommended offer: ${offer.replace(/_/g, " ")}`,
  });

  return NextResponse.json({ leadId: lead.id, overallScore: overall, offer });
}
