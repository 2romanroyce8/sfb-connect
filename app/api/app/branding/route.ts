import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAgencyContext } from "@/lib/agency/context";
export const dynamic = "force-dynamic";

// Branding update. Agency comes from the signed-in membership; the write uses the SESSION client, so RLS (owner/admin only) is the authority.
const https = (v: unknown) => (typeof v === "string" && v.trim() ? (/^https:\/\/[^\s]+$/i.test(v.trim()) ? v.trim().slice(0, 500) : "bad") : null);
export async function POST(req: NextRequest) {
  const r = await getAgencyContext(); if (r.status !== "ok") return NextResponse.json({ error: "Not signed in to an agency." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = typeof b.display_name === "string" ? b.display_name.trim().slice(0, 120) : ""; if (name.length < 2) return NextResponse.json({ error: "Agency name must be at least 2 characters." }, { status: 400 });
  const logo = https(b.logo_url), site = https(b.website), booking = https(b.booking_url);
  if ([logo, site, booking].includes("bad")) return NextResponse.json({ error: "Links must start with https://" }, { status: 400 });
  const color = typeof b.primary_color === "string" && b.primary_color.trim() ? b.primary_color.trim() : null; if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) return NextResponse.json({ error: "Color must look like #287BFF." }, { status: 400 });
  const email = typeof b.contact_email === "string" && b.contact_email.trim() ? b.contact_email.trim().slice(0, 200) : null; if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Contact email isn't valid." }, { status: 400 });
  const db = createSupabaseServerClient();
  const { data, error } = await db.from("agency_branding").upsert({ agency_id: r.ctx.agencyId, display_name: name, logo_url: logo, website: site, booking_url: booking, primary_color: color, contact_email: email, updated_at: new Date().toISOString() }).select("agency_id");
  if (error) return NextResponse.json({ error: error.code === "42501" ? "Only an owner or admin can change branding." : error.message }, { status: error.code === "42501" ? 403 : 400 });
  if (!data?.length) return NextResponse.json({ error: "Nothing was saved." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
