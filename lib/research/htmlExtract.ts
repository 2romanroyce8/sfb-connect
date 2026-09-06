// Pure, deterministic HTML parsing helpers. No AI here — everything below is
// regex/string extraction against real markup, the same class of technique
// as the original business-lookup function, just factored out and expanded.

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export function extractTag(regex: RegExp, html: string): string | null {
  const m = html.match(regex);
  return m ? decodeEntities(m[1].trim()) : null;
}

export function extractTitle(html: string): string | null {
  return extractTag(/<title[^>]*>([^<]*)<\/title>/i, html);
}

export function extractMeta(html: string, name: string): string | null {
  return (
    extractTag(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']`, "i"), html) ||
    extractTag(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`, "i"), html)
  );
}

export function extractJsonLd(html: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else if (parsed["@graph"] && Array.isArray(parsed["@graph"])) blocks.push(...parsed["@graph"]);
      else blocks.push(parsed);
    } catch {
      // malformed JSON-LD — never substitute a guess
    }
  }
  return blocks;
}

export function findLocalBusiness(jsonLd: Record<string, unknown>[]): Record<string, unknown> | undefined {
  return jsonLd.find((b) => {
    const t = Array.isArray(b["@type"]) ? b["@type"].join(",") : String(b["@type"] || "");
    return /LocalBusiness|Organization|Restaurant|Store|ProfessionalService|HomeAndConstructionBusiness/i.test(t);
  });
}

/** Every href in the document, deduped, resolved against the base URL. */
export function extractLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  const re = /href=["']([^"'#][^"']*)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      links.add(new URL(m[1], baseUrl).toString());
    } catch {
      // relative/invalid href we can't resolve — skip rather than guess
    }
  }
  return Array.from(links);
}

export function extractMailtoEmails(html: string): string[] {
  const emails = new Set<string>();
  const re = /mailto:([^"'?\s]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) emails.add(decodeURIComponent(m[1]).toLowerCase());
  return Array.from(emails);
}

export function extractVisibleEmails(html: string): string[] {
  const text = html.replace(/<[^>]+>/g, " ");
  const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const found = text.match(re) || [];
  return Array.from(new Set(found.map((e) => e.toLowerCase()))).filter((e) => !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(e));
}

export function extractPhoneNumbers(html: string): string[] {
  const text = html.replace(/<[^>]+>/g, " ");
  const re = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g;
  return Array.from(new Set(text.match(re) || []));
}

export function extractWhatsAppLinks(html: string): string[] {
  const links = new Set<string>();
  const re = /(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com\/send)\/?[^\s"'<>]*/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) links.add(m[0].startsWith("http") ? m[0] : `https://${m[0]}`);
  return Array.from(links);
}

/** Visible body text with tags stripped, for heuristic "areas we serve" scanning. */
export function extractVisibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
