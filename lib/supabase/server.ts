import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { REMEMBER_COOKIE, applyPersistence, shouldPersist } from "./sessionPolicy";

/**
 * Server-side Supabase client for Server Components, Route Handlers and
 * Server Actions. Uses the getAll/setAll cookie API -- the deprecated
 * get/set/remove trio is what @supabase/ssr itself documents as a cause of
 * "random logouts, early session termination".
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        const persist = shouldPersist(cookieStore.get(REMEMBER_COOKIE)?.value);
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options.maxAge === 0 ? options : applyPersistence(options, persist));
          }
        } catch {
          // Called from a Server Component, which cannot write cookies. Safe:
          // the middleware refreshes and persists the session on every
          // /team and /dashboard request.
        }
      },
    },
  });
}

/**
 * Service-role client for privileged server-only operations (webhooks, admin
 * writes that must bypass RLS). NEVER import this into client components.
 */
import { createClient } from "@supabase/supabase-js";

export function createSupabaseServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}
