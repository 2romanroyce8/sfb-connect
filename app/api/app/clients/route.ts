import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { getAgencyContext } from "@/lib/agency/context";
import { appOrigin } from "@/lib/agent/auth";
import { rateLimit } from "@/lib/agent/store";
import { newInviteToken, hashInviteToken, INVITE_TTL_MS } from "@/lib/agency/invite";
export const dynamic = "force-dynamic";

// Agency-side client management. Agency from the membership; writes through the SESSION client so RLS (owner/admin/sales/fulfillment) decides.
// An invite only creates a LINK for the owner to share; nothing is emailed from here.
const UUID = /^[0-9a-f-]{36}$/i; const STAFF = ["owner", "admin", "sales_manager", "fulfillment_manager"];
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const s = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
export async function POST(req: NextRequest) {
  const r = await getAgencyContext(); if (r.status !== "ok") return fail("Not signed in to an agency.", 401);
  if (!STAFF.includes(r.ctx.role)) return fail("Your role can't manage clients.", 403);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>; const db = createSupabaseServerClient(); const ag = r.ctx.agencyId;
  switch (b.action) {
    case "create": {
      const name = s(b.name, 160); if (name.length < 2) return fail("Client name is required.");
      let site = s(b.website, 300) || null; if (site && !/^https?:\/\//i.test(site)) site = `https://${site}`;
      const { count } = await db.from("agy_clients").select("id", { count: "exact", head: true }).eq("agency_id", ag); if ((count ?? 0) >= 200) return fail("You've reached the 200-client limit.", 429);
      const { data, error } = await db.from("agy_clients").insert({ agency_id: ag, name, website: site, status: "onboarding" }).select("id").single(); if (error) return fail(error.code === "42501" ? "Your role can't add clients." : error.message);
      await createSupabaseServiceClient().from("agy_onboarding").insert({ client_id: data.id, agency_id: ag }); // empty draft so the portal has a record
      return NextResponse.json({ ok: true, id: data.id });
    }
    case "invite": {
      if (!(await rateLimit(`client-invite:${r.ctx.userId}:1h`, 30, 3600)).allowed) return fail("Too many invites. Try again later.", 429);
      const id = s(b.client_id, 40), email = s(b.email, 200).toLowerCase(); if (!UUID.test(id)) return fail("Unknown client."); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email address.");
      const { data: c } = await db.from("agy_clients").select("id").eq("id", id).eq("agency_id", ag).maybeSingle(); if (!c) return fail("Client not found.", 404);
      const token = newInviteToken();
      const { error } = await db.from("agy_client_invites").insert({ client_id: id, agency_id: ag, email, token_hash: hashInviteToken(token), expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString(), created_by: r.ctx.userId }); if (error) return fail(error.message);
      return NextResponse.json({ ok: true, link: `${appOrigin(req)}/portal/join?token=${encodeURIComponent(token)}`, expiresInDays: 7 });
    }
    case "review": {
      const id = s(b.client_id, 40), decision = b.decision === "approve" ? "approved" : b.decision === "changes" ? "changes_requested" : ""; if (!UUID.test(id) || !decision) return fail("Choose approve or request changes.");
      const note = s(b.note, 1000) || null; if (decision === "changes_requested" && !note) return fail("Say what needs to change.");
      const { data, error } = await db.from("agy_onboarding").update({ status: decision, review_note: note, reviewed_at: new Date().toISOString(), reviewed_by: r.ctx.userId, updated_at: new Date().toISOString() }).eq("client_id", id).eq("agency_id", ag).eq("status", "submitted").select("client_id");
      if (error) return fail(error.message); if (!data?.length) return fail("That onboarding isn't waiting for review.", 409);
      if (decision === "approved") await db.from("agy_clients").update({ status: "active" }).eq("id", id).eq("agency_id", ag);
      return NextResponse.json({ ok: true });
    }
  }
  return fail("Unknown action.");
}
