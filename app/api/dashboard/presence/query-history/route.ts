import { NextRequest, NextResponse } from "next/server";
import { getCustomerContext } from "@/lib/customerPortal/context";
import { getQueryHistory } from "@/lib/customerPortal/presence";

/**
 * On-demand query detail history -- called only when a customer opens a
 * specific query's detail drawer, not on the main page load, so a
 * long-history customer never has to load every observation up front.
 * business_id comes ONLY from the authorized customer context, never from
 * the request -- a query string can specify platform/query/location, but
 * never whose business to look at.
 */
export async function GET(req: NextRequest) {
  const result = await getCustomerContext("/dashboard/presence");
  if (result.status === "no_customer") return NextResponse.json({ error: "No active membership." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform");
  const queryText = searchParams.get("query");
  const locationId = searchParams.get("locationId");

  if (!platform || !queryText) {
    return NextResponse.json({ error: "platform and query are required." }, { status: 400 });
  }

  const history = await getQueryHistory(result.context.business.id, platform, queryText, locationId || null);
  return NextResponse.json({ history });
}
