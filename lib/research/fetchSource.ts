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

async function fetchOnce(url: string): Promise<{ ok: boolean; finalUrl: string; html: string; blockedReason?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
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
      const blocked = SOCIAL_LOGIN_WALLED.has(new URL(url).hostname.replace(/^www\./, "")) || res.status === 403 || res.status === 429 || res.status === 999;
      return { ok: false, finalUrl: res.url || url, html: "", blockedReason: blocked ? `HTTP ${res.status} — likely login-walled` : `HTTP ${res.status}` };
    }
    const html = await res.text();
    const looksLoginWalled =
      SOCIAL_LOGIN_WALLED.has(new URL(res.url || url).hostname.replace(/^www\./, "")) &&
      (/log ?in to (see|view)|you must log in|content isn.t available/i.test(html) || html.length < 2000);
    if (looksLoginWalled) return { ok: false, finalUrl: res.url || url, html, blockedReason: "login wall" };
    return { ok: true, finalUrl: res.url || url, html };
  } catch (err) {
    clearTimeout(timeout);
    return { ok: false, finalUrl: url, html: "", blockedReason: err instanceof Error && err.name === "AbortError" ? "timeout" : "network error" };
  }
}

export async function fetchPage(rawUrl: string): Promise<FetchedPage> {
  const url = normalizeUrl(rawUrl);
  const sourceType = classifySourceType(url);

  const first = await fetchOnce(url);
  if (first.ok) return { url, finalUrl: first.finalUrl, ok: true, html: first.html, sourceType };

  // Legitimate fallback, not a bypass: mbasic.facebook.com is the same
  // public page, served by Facebook itself as its lightweight/basic-browser
  // surface. It's frequently reachable without a login wall for public
  // Business Pages even when the full www.facebook.com render blocks a
  // non-browser client -- this doesn't circumvent any access control, it
  // just uses the plain-HTML entry point Facebook already offers.
  let hostname = "";
  try {
    hostname = new URL(url).hostname.replace(/^www\.|^m\./, "");
  } catch {
    // leave hostname empty
  }
  if (hostname === "facebook.com") {
    const mbasicUrl = url.replace(/^https?:\/\/(www\.|m\.)?facebook\.com/i, "https://mbasic.facebook.com");
    if (mbasicUrl !== url) {
      const fallback = await fetchOnce(mbasicUrl);
      if (fallback.ok) {
        return { url, finalUrl: fallback.finalUrl, ok: true, html: fallback.html, sourceType };
      }
    }
  }

  return { url, finalUrl: first.finalUrl, ok: false, html: first.html, sourceType, blockedReason: first.blockedReason };
}
