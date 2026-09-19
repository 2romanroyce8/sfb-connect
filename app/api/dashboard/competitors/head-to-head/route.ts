import { NextRequest, NextResponse } from "next/server";
import { getCustomerContext } from "@/lib/customerPortal/context";
import { getHeadToHead } from "@/lib/customerPortal/competitors";

export async function GET(req: NextRequest) {
  const result = await getCustomerContext("/dashboard/competitors");
  if (result.status === "no_customer") return NextResponse.json({ error: "No active membership." }, { status: 403 });

  const competitorId = new URL(req.url).searchParams.get("competitorId");
  if (!competitorId) return NextResponse.json({ error: "competitorId is required." }, { status: 400 });

  // getHeadToHead is scoped to result.context.business.id -- a
  // client-supplied competitorId can only ever surface data already
  // scoped to the authorized business's own ai_visibility_observations
  // rows, never another business's.
  const rows = await getHeadToHead(result.context.business.id, competitorId);
  return NextResponse.json({ rows });
}
