import { lookup } from "node:dns/promises";
import net from "node:net";

// Server-side fetch of a USER-SUPPLIED public URL for the website audit. SSRF guards: http(s) only, no credentials in the URL, every resolved address
// must be public (loopback/private/link-local/CGNAT/metadata blocked), redirects re-validated hop by hop, 8 s timeout, 1.5 MB cap, HTML only.
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
    return v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb") || v.startsWith("ff");
  }
  return true;
}

export class AuditFetchError extends Error {}
export function normalizeUrl(input: string): URL {
  let s = input.trim(); if (!s) throw new AuditFetchError("Enter a website address.");
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  let u: URL; try { u = new URL(s); } catch { throw new AuditFetchError("That doesn't look like a valid website address."); }
  if (!["http:", "https:"].includes(u.protocol)) throw new AuditFetchError("Only http and https addresses can be audited.");
  if (u.username || u.password) throw new AuditFetchError("Addresses with a username or password aren't allowed.");
  if (u.port && !["80", "443"].includes(u.port)) throw new AuditFetchError("Only standard web ports can be audited.");
  if (!u.hostname.includes(".") || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) && isPrivateIp(u.hostname)) throw new AuditFetchError("Enter a public website address.");
  return u;
}
async function assertPublic(host: string) {
  if (net.isIP(host)) { if (isPrivateIp(host)) throw new AuditFetchError("Enter a public website address."); return; }
  let addrs: { address: string }[]; try { addrs = await lookup(host, { all: true }); } catch { throw new AuditFetchError("We couldn't find that website."); }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new AuditFetchError("Enter a public website address.");
}

export async function fetchHtml(input: string): Promise<{ html: string; finalUrl: URL; status: number; truncated: boolean; ms: number }> {
  let url = normalizeUrl(input); const t0 = Date.now();
  for (let hop = 0; hop < 4; hop++) {
    await assertPublic(url.hostname);
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 8000);
    let res: Response;
    try { res = await fetch(url, { redirect: "manual", signal: ctl.signal, headers: { "user-agent": "SFBConnectAudit/1.0 (+https://www.sfbconnect.com)", accept: "text/html,application/xhtml+xml" } }); }
    catch { clearTimeout(timer); throw new AuditFetchError("The website didn't respond in time."); }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) { clearTimeout(timer); try { url = normalizeUrl(new URL(res.headers.get("location") as string, url).toString()); } catch { throw new AuditFetchError("The website redirected somewhere we can't audit."); } continue; }
    const ct = res.headers.get("content-type") ?? "";
    if (!/html|xml/i.test(ct)) { clearTimeout(timer); throw new AuditFetchError("That address didn't return a web page."); }
    const reader = res.body?.getReader(); const chunks: Uint8Array[] = []; let size = 0; let truncated = false;
    if (reader) { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 1_500_000) { truncated = true; try { await reader.cancel(); } catch { /* ignore */ } break; } chunks.push(value); } }
    clearTimeout(timer);
    return { html: Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8"), finalUrl: url, status: res.status, truncated, ms: Date.now() - t0 };
  }
  throw new AuditFetchError("The website redirected too many times.");
}
