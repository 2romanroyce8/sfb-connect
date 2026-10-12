import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/team/requireOwner";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { isAnalyticsRange } from "@/lib/team/analytics/date-range";
import { getCompanyAnalytics } from "@/lib/team/analytics/company";
import { cached, ANALYTICS_TTL_MS } from "@/lib/team/analytics/cache";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Owner-only company view from our own records. Cached briefly (same TTL as the Stripe mirror) so the two views line up in time. */
export async function GET(req: NextRequest) {
  const gate = await requireOwner(); if ("error" in gate) return gate.error;
  const r = req.nextUrl.searchParams.get("range") || "30d"; const range = isAnalyticsRange(r) ? r : "30d";
  const out = await cached(`company:${range}`, () => getCompanyAnalytics(createSupabaseServiceClient(), range), { force: req.nextUrl.searchParams.get("refresh") === "1", ttlMs: 60 * 1000 });
  return NextResponse.json({ ...out.data, cache: { fetchedAt: out.fetchedAt, fromCache: out.fromCache, ageMs: out.ageMs, ttlMs: ANALYTICS_TTL_MS, error: out.error } });
}
