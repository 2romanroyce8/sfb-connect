import type { FetchedPage } from "./types";
import { normalizeUrl, classifyLink } from "./normalize";

const SOCIAL_LOGIN_WALLED = new Set(["facebook.com", "instagram.com", "tiktok.com", "linkedin.com", "x.com", "twitter.com"]);

export function classifySourceType(url: string): string {
  const c = classifyLink(url);
  if (c.kind === "social") return c.platform;
  if (c.kind === "whatsapp") return "whatsapp";
  if (c.kind === "booking") return "booking";
  if (c.kind === "linktree") return "link_in_bio";
  return "website";
}

export async function fetchPage(rawUrl: string): Promise<FetchedPage> {
  const url = normalizeUrl(rawUrl);
  const sourceType = classifySourceType(url);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SFBSalesOSBot/2.0; +https://sfbconnect.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) {
      // Most login-walled platforms return 200 with a login-gate page, not a
      // clean error status — an actual non-2xx from one of them is a strong
      // enough signal to call it unavailable rather than "not found".
      const blocked = SOCIAL_LOGIN_WALLED.has(new URL(url).hostname.replace(/^www\./, "")) || res.status === 403 || res.status === 429 || res.status === 999;
      return { url, finalUrl: res.url || url, ok: false, html: "", sourceType, blockedReason: blocked ? `HTTP ${res.status} — likely login-walled` : `HTTP ${res.status}` };
    }
    const html = await res.text();
    // Heuristic login-wall detection for platforms that return 200 anyway.
    const looksLoginWalled =
      SOCIAL_LOGIN_WALLED.has(new URL(res.url || url).hostname.replace(/^www\./, "")) &&
      (/log ?in to (see|view)|you must log in|content isn.t available/i.test(html) || html.length < 2000);
    if (looksLoginWalled) {
      return { url, finalUrl: res.url || url, ok: false, html, sourceType, blockedReason: "login wall" };
    }
    return { url, finalUrl: res.url || url, ok: true, html, sourceType };
  } catch (err) {
    return { url, finalUrl: url, ok: false, html: "", sourceType, blockedReason: err instanceof Error && err.name === "AbortError" ? "timeout" : "network error" };
  }
}
