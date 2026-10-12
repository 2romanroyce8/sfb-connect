import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { customerBusiness } from "@/lib/onboarding/state";
import { getClearance, submitEmail, isBlocked } from "@/lib/google/clearance";
import { normalizeGoogleEmail, canStartGoogleOAuth, CUSTOMER_WAITING_COPY, CUSTOMER_BLOCKED_COPY } from "@/lib/google/gate";
import { appOrigin } from "@/lib/agent/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Customer view of their Google clearance: status, the address on file, whether Connect is live, and the copy to show. */
export async function GET() {
  const who = await customerBusiness(createSupabaseServerClient());
  if (!who) return NextResponse.json({ error: "No active membership." }, { status: 403 });
  const service = createSupabaseServiceClient();
  const [c, blocked] = await Promise.all([getClearance(service, who.businessId), isBlocked(service)]);
  const status = c?.status ?? "not_started";
  return NextResponse.json({ status, email: c?.email ?? null, canConnect: canStartGoogleOAuth(status, false), waitingCopy: blocked && status === "email_submitted" ? CUSTOMER_BLOCKED_COPY : CUSTOMER_WAITING_COPY, submittedAt: c?.submitted_at ?? null });
}

/** {email} — the Google address the customer will connect with. Fires the team notification; the button stays gated. */
export async function POST(req: NextRequest) {
  const who = await customerBusiness(createSupabaseServerClient());
  if (!who) return NextResponse.json({ error: "No active membership." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { email?: unknown };
  const email = normalizeGoogleEmail(body.email);
  if (!email) return NextResponse.json({ error: "Enter the Google address you'll connect with (e.g. you@gmail.com or you@yourdomain.com)." }, { status: 400 });
  const service = createSupabaseServiceClient();
  const { data: biz } = await service.from("businesses").select("id, legal_name").eq("id", who.businessId).single();
  const c = await submitEmail(service, { id: biz!.id, legal_name: biz!.legal_name }, email, appOrigin(req));
  const blocked = await isBlocked(service);
  return NextResponse.json({ ok: true, status: c.status, email: c.email, canConnect: canStartGoogleOAuth(c.status, false), waitingCopy: blocked && c.status === "email_submitted" ? CUSTOMER_BLOCKED_COPY : CUSTOMER_WAITING_COPY });
}
