import type { FetchedPage, LocationRecord } from "./types";
import { extractJsonLd, findLocalBusiness, extractVisibleText } from "./htmlExtract";

// Service-area extraction is inherently a text heuristic, not a structured
// lookup — every record it produces is tagged `service_area` /
// `uncertain` at LOW-to-MEDIUM confidence, never `primary`. A tagged city in
// a sentence is not a physical branch unless a real address says otherwise.
const SERVICE_AREA_TRIGGERS = /(?:service area|areas we serve|we (?:proudly )?serve|serving the following|cities we serve)[:\s]/i;

function looksLikeCity(token: string): boolean {
  const t = token.trim();
  if (t.length < 3 || t.length > 40) return false;
  if (!/^[A-Z][a-zA-Z.\s]+$/.test(t)) return false;
  if (/\b(and|the|our|home|about|contact|us|read|more|click|here)\b/i.test(t)) return false;
  return true;
}

export function discoverLocations(pages: FetchedPage[]): LocationRecord[] {
  const records: LocationRecord[] = [];
  const seenServiceAreas = new Set<string>();

  for (const page of pages) {
    if (!page.ok) continue;

    const localBusiness = findLocalBusiness(extractJsonLd(page.html));
    const address = localBusiness?.address as Record<string, unknown> | undefined;
    if (address) {
      const street = address["streetAddress"] ? String(address["streetAddress"]) : null;
      const city = address["addressLocality"] ? String(address["addressLocality"]) : null;
      const state = address["addressRegion"] ? String(address["addressRegion"]) : null;
      const postal = address["postalCode"] ? String(address["postalCode"]) : null;
      if (city || street) {
        records.push({
          name: null,
          address: street,
          city,
          state,
          postalCode: postal,
          locationType: "primary",
          status: "verified",
          confidence: 0.9,
          sourceUrl: page.finalUrl,
        });
      }
    }

    // areaServed on LocalBusiness schema — structured, so treated as
    // higher-confidence service areas than the free-text heuristic below.
    const areaServed = localBusiness?.areaServed;
    if (areaServed) {
      const list = Array.isArray(areaServed) ? areaServed : [areaServed];
      for (const a of list) {
        const name = typeof a === "string" ? a : (a as any)?.name;
        if (name && !seenServiceAreas.has(String(name).toLowerCase())) {
          seenServiceAreas.add(String(name).toLowerCase());
          records.push({
            name: String(name),
            address: null,
            city: String(name),
            state: null,
            postalCode: null,
            locationType: "service_area",
            status: "uncertain",
            confidence: 0.6,
            sourceUrl: page.finalUrl,
          });
        }
      }
    }

    // Free-text heuristic: find a trigger phrase, then pull a comma/bullet
    // list of capitalized city-like tokens that follows it.
    const text = extractVisibleText(page.html);
    const triggerMatch = text.match(SERVICE_AREA_TRIGGERS);
    if (triggerMatch && triggerMatch.index != null) {
      const after = text.slice(triggerMatch.index + triggerMatch[0].length, triggerMatch.index + triggerMatch[0].length + 400);
      const pieces = after.split(/,|•|\|/).slice(0, 12);
      for (const piece of pieces) {
        const candidate = piece.trim().split(/\s{2,}|\.\s/)[0];
        if (looksLikeCity(candidate) && !seenServiceAreas.has(candidate.toLowerCase())) {
          seenServiceAreas.add(candidate.toLowerCase());
          records.push({
            name: candidate,
            address: null,
            city: candidate,
            state: null,
            postalCode: null,
            locationType: "service_area",
            status: "uncertain",
            confidence: 0.4,
            sourceUrl: page.finalUrl,
          });
        }
      }
    }
  }

  return records;
}
