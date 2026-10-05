"use client";

import { createBrowserClient } from "@supabase/ssr";
import { REMEMBER_COOKIE, hardenCookie, shouldPersist } from "./sessionPolicy";

type SetCookie = { name: string; value: string; options: Record<string, unknown> };

function readAllCookies(): { name: string; value: string }[] {
  if (typeof document === "undefined" || !document.cookie) return [];
  return document.cookie.split(";").map((part) => {
    const idx = part.indexOf("=");
    const name = decodeURIComponent(part.slice(0, idx).trim());
    const value = decodeURIComponent(part.slice(idx + 1).trim());
    return { name, value };
  });
}

function serializeCookie(name: string, value: string, o: Record<string, unknown>): string {
  let s = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  if (typeof o.maxAge === "number") s += `; Max-Age=${Math.floor(o.maxAge)}`;
  if (o.expires instanceof Date) s += `; Expires=${o.expires.toUTCString()}`;
  if (o.domain) s += `; Domain=${o.domain}`;
  s += `; Path=${(o.path as string) || "/"}`;
  if (o.sameSite) s += `; SameSite=${String(o.sameSite).charAt(0).toUpperCase()}${String(o.sameSite).slice(1)}`;
  if (o.secure) s += "; Secure";
  return s;
}

/**
 * Browser client. Uses explicit cookie handlers (not the library's
 * document.cookie default) so the "Stay signed in" choice can turn the auth
 * cookies into session cookies -- the library otherwise forces a 400-day
 * max-age on every write.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return readAllCookies();
      },
      setAll(cookiesToSet: SetCookie[]) {
        const persist = shouldPersist(readAllCookies().find((c) => c.name === REMEMBER_COOKIE)?.value);
        const isHttps = typeof location !== "undefined" && location.protocol === "https:";
        for (const { name, value, options } of cookiesToSet) {
          document.cookie = serializeCookie(name, value, hardenCookie(options, isHttps, persist));
        }
      },
    },
  });
}

/** Records the user's "Stay signed in" choice. Call before signing in. */
export function setRememberPreference(remember: boolean) {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:";
  // The preference itself is long-lived either way so the next login screen
  // can default to what the user picked last time.
  document.cookie = serializeCookie(REMEMBER_COOKIE, remember ? "1" : "0", { maxAge: 400 * 24 * 60 * 60, path: "/", sameSite: "lax", secure });
}

export function getRememberPreference(): boolean {
  return shouldPersist(readAllCookies().find((c) => c.name === REMEMBER_COOKIE)?.value);
}
