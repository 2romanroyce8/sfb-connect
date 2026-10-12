import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { availableSlots, ET } from "@/lib/demoCall/booking";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Open demo-call slots for the next 10 days, 30 min each, Eastern, straight from the live calendar. */
export async function GET() {
  const r = await availableSlots(createSupabaseServiceClient());
  return NextResponse.json({ ...r, timeZone: ET, label: "All times Eastern (ET)" }, { headers: { "Cache-Control": "no-store" } });
}
