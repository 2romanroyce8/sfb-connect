// Pure HTML checks (testable). Reads only what the server returned for the page; no JavaScript is executed, so pages built entirely client-side may show fewer signals.
export type Check = { id: string; label: string; result: "pass" | "warn" | "fail"; evidence: string; confidence: "high" | "medium" };
const text = (s: string) => s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const attr = (tag: string, name: string) => (tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")) ?? [])[2] ?? (tag.match(new RegExp(`${name}\\s*=\\s*'([^']*)'`, "i")) ?? [])[1] ?? (tag.match(new RegExp(`${name}\\s*=\\s*([^\\s>"']+)`, "i")) ?? [])[1] ?? null;
const clip = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function auditHtml(html: string, finalUrl: string): Check[] {
  const out: Check[] = []; const add = (id: string, label: string, result: Check["result"], evidence: string, confidence: Check["confidence"] = "high") => out.push({ id, label, result, evidence, confidence });
  const https = finalUrl.startsWith("https://");
  add("https", "HTTPS", https ? "pass" : "fail", https ? `Loaded over HTTPS at ${new URL(finalUrl).host}.` : "The page was served over plain HTTP.");
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ?? [])[1]?.replace(/\s+/g, " ").trim() ?? "";
  add("title", "Page title", !title ? "fail" : title.length < 15 || title.length > 70 ? "warn" : "pass", !title ? "No <title> tag found." : `"${clip(title)}" (${title.length} characters; 15–70 reads well in results).`);
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const desc = metas.find((m) => /name\s*=\s*["']?description/i.test(m)); const descText = desc ? attr(desc, "content") ?? "" : "";
  add("description", "Meta description", !descText ? "fail" : descText.length < 70 || descText.length > 170 ? "warn" : "pass", !descText ? "No meta description found." : `"${clip(descText, 110)}" (${descText.length} characters).`);
  const viewport = metas.some((m) => /name\s*=\s*["']?viewport/i.test(m));
  add("viewport", "Mobile viewport", viewport ? "pass" : "fail", viewport ? "Viewport meta tag present." : "No viewport meta tag, so phones may show a shrunken desktop page.");
  const h1s = [...html.matchAll(/<h1\b[\s\S]*?<\/h1>/gi)].map((m) => text(m[0]));
  add("h1", "Main heading (H1)", h1s.length === 1 ? "pass" : h1s.length === 0 ? "fail" : "warn", h1s.length === 0 ? "No H1 found." : h1s.length === 1 ? `One H1: "${clip(h1s[0], 80)}".` : `${h1s.length} H1 headings found; one is the usual pattern.`);
  const levels = [...html.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1])); let skips = 0; for (let i = 1; i < levels.length; i++) if (levels[i] - levels[i - 1] > 1) skips++;
  add("headings", "Heading order", levels.length < 2 ? "warn" : skips ? "warn" : "pass", levels.length < 2 ? `Only ${levels.length} heading(s) found.` : skips ? `${skips} place(s) where heading levels skip (for example H2 to H4).` : `${levels.length} headings in a sensible order.`);
  const ld = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]); const types: string[] = [];
  for (const b of ld) { for (const m of b.matchAll(/"@type"\s*:\s*"([^"]+)"/g)) types.push(m[1]); }
  add("schema", "Structured data (schema)", types.length ? "pass" : "warn", types.length ? `Found: ${[...new Set(types)].slice(0, 5).join(", ")}.` : "No JSON-LD structured data found. Local business schema helps search engines and AI assistants.");
  const body = text(html); const tel = /href\s*=\s*["']tel:/i.test(html); const phoneText = /(\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/.test(body); const mail = /href\s*=\s*["']mailto:/i.test(html);
  add("contact", "Contact information", tel || phoneText ? (tel ? "pass" : "warn") : "fail", tel ? "A tap-to-call phone link was found." : phoneText ? "A phone number appears as text, but not as a tap-to-call link." : "No phone number found in the page text.", "medium");
  add("email", "Email contact", mail ? "pass" : "warn", mail ? "A mailto link was found." : "No email link found (a contact form may exist elsewhere).", "medium");
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]); const noAlt = imgs.filter((i) => attr(i, "alt") === null).length;
  add("alt", "Image alt text", !imgs.length ? "warn" : noAlt === 0 ? "pass" : noAlt / imgs.length > 0.3 ? "fail" : "warn", !imgs.length ? "No <img> images found in the page HTML." : noAlt === 0 ? `All ${imgs.length} images have alt text.` : `${noAlt} of ${imgs.length} images have no alt attribute.`);
  const lang = /<html\b[^>]*\blang\s*=/i.test(html);
  add("lang", "Page language", lang ? "pass" : "warn", lang ? "A language is declared on the <html> tag." : "No lang attribute on the <html> tag.");
  const canon = /<link\b[^>]*rel\s*=\s*["']?canonical/i.test(html);
  add("canonical", "Canonical link", canon ? "pass" : "warn", canon ? "A canonical link is set." : "No canonical link found.");
  return out;
}
export const summarize = (c: Check[]) => ({ pass: c.filter((x) => x.result === "pass").length, warn: c.filter((x) => x.result === "warn").length, fail: c.filter((x) => x.result === "fail").length, total: c.length });
