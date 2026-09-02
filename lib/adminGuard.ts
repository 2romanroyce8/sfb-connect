import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Confirms the current request's session belongs to an admin. Use at the
 * top of every /api/admin/** route handler — middleware already blocks page
 * navigation, but API routes are reachable directly and need their own check.
 */
export async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, message: "Not authenticated." };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { ok: false as const, status: 403, message: "Admin access required." };
  }

  return { ok: true as const, userId: user.id };
}
