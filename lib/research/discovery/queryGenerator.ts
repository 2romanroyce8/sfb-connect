// Deterministic search-query generation from verified identity signals.
// No LLM decides these -- every query is built from a fixed template set,
// deduplicated, and never emitted with an undefined/blank field spliced in.

export type DiscoveryPurpose = "official_website" | "contacts" | "socials" | "reputation" | "booking" | "general";

export type IdentitySignals = {
  businessName?: string | null;
  handle?: string | null;
  city?: string | null;
  state?: string | null;
  category?: string | null;
  phone?: string | null;
};

function clean(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export function generateDiscoveryQueries(signals: IdentitySignals, purpose: DiscoveryPurpose, limit = 4): string[] {
  const name = clean(signals.businessName);
  const handle = clean(signals.handle);
  const city = clean(signals.city);
  const state = clean(signals.state);
  const category = clean(signals.category);
  const phone = clean(signals.phone);

  const queries: string[] = [];
  function add(q: string | null) {
    if (q && !queries.includes(q)) queries.push(q);
  }

  // Priority order matters: an exact uncommon handle or name+city is a much
  // stronger signal than a bare business name, so those are generated
  // (and therefore tried) first.
  if (purpose === "official_website") {
    if (handle) add(`"${handle}" website`);
    if (name && city) add(`"${name}" "${city}" website`);
    if (name && state) add(`"${name}" "${state}" website`);
    if (phone) add(`"${phone}"`);
    if (name && category) add(`"${name}" "${category}"`);
    if (name) add(`"${name}" official website`);
  } else if (purpose === "contacts") {
    if (name) add(`"${name}" contact`);
    if (name) add(`"${name}" phone`);
    if (name) add(`"${name}" email`);
  } else if (purpose === "socials") {
    if (handle) add(`"${handle}"`);
    if (name) add(`"${name}" Instagram`);
    if (name) add(`"${name}" TikTok`);
    if (name) add(`"${name}" LinkedIn`);
    if (name) add(`"${name}" YouTube`);
  } else if (purpose === "reputation") {
    if (name && city) add(`"${name}" "${city}" reviews`);
    if (name) add(`"${name}" reviews`);
  } else if (purpose === "booking") {
    if (name) add(`"${name}" booking`);
  } else {
    if (name && city) add(`"${name}" "${city}"`);
    if (name) add(`"${name}"`);
  }

  return queries.slice(0, limit);
}
