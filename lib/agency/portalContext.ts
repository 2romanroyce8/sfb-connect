import { createSupabaseServerClient } from "@/lib/supabase/server";
// Resolves the signed-in CLIENT user: their client record, the agency's public branding, and their onboarding. Everything through the session client (RLS).
export type PortalCtx = { userId: string; email: string; client: { id: string; name: string; status: string }; brand: { name: string; logoUrl: string | null; color: string | null }; onboarding: { status: string; answers: Record<string, string>; review_note: string | null } };
export async function getPortalContext(): Promise<{ status: "anon" } | { status: "no_client"; email: string } | { status: "ok"; ctx: PortalCtx }> {
  const db = createSupabaseServerClient(); const { data: { user } } = await db.auth.getUser(); if (!user) return { status: "anon" };
  const { data: m } = await db.from("agy_client_members").select("client_id, agency_id").eq("user_id", user.id).order("created_at").limit(1).maybeSingle();
  if (!m) return { status: "no_client", email: user.email ?? "" };
  const [{ data: c }, { data: o }] = await Promise.all([db.from("agy_clients").select("id, name, status").eq("id", m.client_id).maybeSingle(), db.from("agy_onboarding").select("status, answers, review_note").eq("client_id", m.client_id).maybeSingle()]);
  if (!c) return { status: "no_client", email: user.email ?? "" };
  // Agency branding is public by design (it appears on demo pages too), read with the service client but only these three columns for THIS client's agency.
  const { createSupabaseServiceClient } = await import("@/lib/supabase/server"); const svc = createSupabaseServiceClient();
  const [{ data: b }, { data: ag }] = await Promise.all([svc.from("agency_branding").select("display_name, logo_url, primary_color").eq("agency_id", m.agency_id).maybeSingle(), svc.from("agencies").select("name").eq("id", m.agency_id).maybeSingle()]);
  const https = (u: unknown) => (typeof u === "string" && /^https:\/\/[^\s]+$/i.test(u) ? u : null); const hex = (u: unknown) => (typeof u === "string" && /^#[0-9a-fA-F]{6}$/.test(u) ? u : null);
  return { status: "ok", ctx: { userId: user.id, email: user.email ?? "", client: { id: c.id as string, name: c.name as string, status: c.status as string }, brand: { name: (b?.display_name as string) || (ag?.name as string) || "Your agency", logoUrl: https(b?.logo_url), color: hex(b?.primary_color) }, onboarding: { status: (o?.status as string) ?? "draft", answers: ((o?.answers ?? {}) as Record<string, string>), review_note: (o?.review_note as string | null) ?? null } } };
}
