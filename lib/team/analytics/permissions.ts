import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AnalyticsScope = {
  isOwner: boolean;
  userId: string;
  /** null means "no rep restriction" -- only ever true for an owner who
   * didn't ask to filter to one employee. A sales rep's scope is NEVER
   * null; it's always their own user id, regardless of what the request
   * asked for. */
  effectiveRepId: string | null;
};

/**
 * Resolves who's allowed to see what, entirely server-side. A rep account
 * can request repId=<anyone> all it wants -- this function ignores that
 * and pins effectiveRepId to the caller's own id. Only an owner's
 * requested filter is ever honored, and even then only because the owner
 * is explicitly allowed company-wide access anyway.
 */
export async function resolveAnalyticsScope(requestedRepId: string | null): Promise<AnalyticsScope> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  const isOwner = profile?.team_role === "owner";

  if (!isOwner) {
    return { isOwner: false, userId: user.id, effectiveRepId: user.id };
  }
  return { isOwner: true, userId: user.id, effectiveRepId: requestedRepId || null };
}
