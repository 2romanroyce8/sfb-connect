import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const VALID_EVENTS = [
  "pricing_addons_viewed",
  "addon_card_clicked",
  "addon_detail_opened",
  "credits_viewed",
  "multi_location_clicked",
  "addon_cta_clicked",
  "pricing_plan_selected",
  "demo_started_from_addon",
  // SFB Agent site revision (2026-10-09)
  "trial_signup_start",
  "trial_signup_complete",
  "capability_card_click",
  "faq_question_asked",
  "integration_tile_click",
  "pricing_card_click",
  "topup_click",
  "demo_video_play",
];

// A real, minimal event log -- no analytics provider is connected in this
// codebase, so this is queried directly rather than presented as
// integrated with a provider that doesn't exist. Public insert is
// intentional (anonymous pricing-page visitors), read is owner-only.
export async function POST(req: NextRequest) {
  // sendBeacon posts a Blob; parse the text ourselves so the content-type never matters.
  const body = await req.text().then((t) => (t ? JSON.parse(t) : null)).catch(() => null);
  const eventName = body?.eventName;
  if (!VALID_EVENTS.includes(eventName)) return NextResponse.json({ error: "Unknown event." }, { status: 400 });

  const service = createSupabaseServiceClient();
  await service.from("marketing_events").insert({ event_name: eventName, detail: body?.detail ?? null });
  return NextResponse.json({ ok: true });
}
