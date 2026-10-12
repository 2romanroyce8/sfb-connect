import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/team/requireOwner";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { isAnalyticsRange } from "@/lib/team/analytics/date-range";
import { fetchStripeMirror } from "@/lib/team/analytics/stripeMirror";
import { cached, ANALYTICS_TTL_MS } from "@/lib/team/analytics/cache";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Owner-only, read-only Stripe mirror. Served from analytics_cache (5 min TTL); ?refresh=1 re-pulls (30 s floor). */
export async function GET(req: NextRequest) {
  const gate = await requireOwner(); if ("error" in gate) return gate.error;
  if (!isStripeConfigured()) return NextResponse.json({ error: "Stripe isn't configured on this deployment." }, { status: 503 });
  const r = req.nextUrl.searchParams.get("range") || "30d"; const range = isAnalyticsRange(r) ? r : "30d";
  try {
    const out = await cached(`stripe_mirror:${range}`, () => fetchStripeMirror(range), { force: req.nextUrl.searchParams.get("refresh") === "1" });
    return NextResponse.json({ ...out.data, cache: { fetchedAt: out.fetchedAt, fromCache: out.fromCache, ageMs: out.ageMs, ttlMs: ANALYTICS_TTL_MS, error: out.error } });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Stripe read failed." }, { status: 502 }); }
}
