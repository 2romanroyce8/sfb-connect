import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AgencyCtx = { userId: string; userName: string; agencyId: string; agencyName: string; role: string };
/** Resolves the signed-in user's agency from agency_members through the SESSION client (RLS). Never trusts ids from the request. */
export async function getAgencyContext(): Promise<{ status: "anon" } | { status: "no_agency"; userId: string } | { status: "ok"; ctx: AgencyCtx }> {
  const db = createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser(); if (!user) return { status: "anon" };
  const { data: m } = await db.from("agency_members").select("agency_id, role, agencies(name)").eq("user_id", user.id).eq("status", "active").order("created_at").limit(1).maybeSingle();
  if (!m) return { status: "no_agency", userId: user.id };
  const ag = (Array.isArray(m.agencies) ? m.agencies[0] : m.agencies) as { name: string } | null;
  const { data: p } = await db.from("users").select("full_name, email").eq("id", user.id).maybeSingle();
  return { status: "ok", ctx: { userId: user.id, userName: (p?.full_name as string) || (p?.email as string) || "You", agencyId: m.agency_id as string, agencyName: ag?.name ?? "Your agency", role: m.role as string } };
}
export const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
