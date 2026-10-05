/**
 * "Stay signed in" policy shared by the browser client, the server client
 * and the middleware.
 *
 * @supabase/ssr always writes auth cookies with a 400-day max-age, so the
 * only way to offer a genuine session-only login is to strip the expiry
 * attributes ourselves at write time. The user's choice is recorded in a
 * plain cookie (set on the login page BEFORE signInWithPassword, so the very
 * first auth cookies already honor it). Default is to stay signed in.
 */
export const REMEMBER_COOKIE = "sfb_remember";
export const REMEMBER_MAX_AGE = 400 * 24 * 60 * 60;

export function shouldPersist(cookieValue: string | undefined | null): boolean {
  return cookieValue !== "0";
}

type CookieAttrs = { maxAge?: number; expires?: Date; [k: string]: unknown };

/** Returns cookie options that are either persistent (as given) or
 * session-only (no max-age, no expires), per the user's choice. */
export function applyPersistence<T extends CookieAttrs>(options: T, persist: boolean): T {
  if (persist) return options;
  const { maxAge: _m, expires: _e, ...rest } = options;
  return rest as T;
}

/** Auth cookies are always Secure on HTTPS (the library default leaves the
 * flag off). Deletions pass through untouched. */
export function hardenCookie<T extends CookieAttrs>(options: T, isHttps: boolean, persist: boolean): T {
  if (options.maxAge === 0) return options;
  const withPersistence = applyPersistence(options, persist);
  return isHttps ? ({ ...withPersistence, secure: true } as T) : withPersistence;
}
