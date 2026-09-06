// Deterministic normalization — no AI involved. Getting "company.com" and
// "https://www.company.com/" to compare equal is what lets the identity
// resolver and evidence validator work at all.

export function normalizeUrl(input: string): string {
  let t = input.trim();
  if (!/^https?:\/\//i.test(t)) t = `https://${t}`;
  try {
    const u = new URL(t);
    u.hash = "";
    return u.toString();
  } catch {
    return t;
  }
}

export function canonicalDomain(url: string): string | null {
  try {
    const u = new URL(normalizeUrl(url));
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(value);
}

const SOCIAL_HOSTS: Record<string, "facebook" | "instagram" | "tiktok" | "linkedin" | "youtube" | "x" | "whatsapp"> = {
  "facebook.com": "facebook",
  "fb.com": "facebook",
  "instagram.com": "instagram",
  "tiktok.com": "tiktok",
  "linkedin.com": "linkedin",
  "youtube.com": "youtube",
  "youtu.be": "youtube",
  "twitter.com": "x",
  "x.com": "x",
  "wa.me": "whatsapp",
};

export type LinkClassification =
  | { kind: "social"; platform: "facebook" | "instagram" | "tiktok" | "linkedin" | "youtube" | "x" | "whatsapp" }
  | { kind: "whatsapp" }
  | { kind: "booking" }
  | { kind: "linktree" }
  | { kind: "other" };

export function classifyLink(url: string): LinkClassification {
  const domain = canonicalDomain(url) || "";
  if (domain === "wa.me" || domain === "api.whatsapp.com") return { kind: "whatsapp" };
  if (domain in SOCIAL_HOSTS) return { kind: "social", platform: SOCIAL_HOSTS[domain] };
  if (["linktr.ee", "beacons.ai", "campsite.bio", "bio.link", "carrd.co"].includes(domain)) return { kind: "linktree" };
  if (["calendly.com", "squareup.com", "square.site", "booksy.com", "acuityscheduling.com", "setmore.com"].includes(domain)) return { kind: "booking" };
  return { kind: "other" };
}

export function socialPlatformFor(url: string) {
  const domain = canonicalDomain(url) || "";
  return SOCIAL_HOSTS[domain] || null;
}

export function isSocialOrDirectoryHost(url: string): boolean {
  const domain = canonicalDomain(url) || "";
  return domain in SOCIAL_HOSTS || ["google.com", "yelp.com", "bbb.org", "yellowpages.com"].includes(domain);
}
