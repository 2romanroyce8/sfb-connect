import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/team/requireOwner";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { createZapierKey } from "@/lib/integrations/zapier";
import { markProviderVerified } from "@/lib/integrations/connections";

export const runtime = "nodejs";

/** Owner mints a Zapier API key. The key is returned ONCE; only its hash is stored. */
export async function POST(req: NextRequest) {
  const g = await requireOwner(); if ("error" in g) return g.error;
  const body = (await req.json().catch(() => ({}))) as { label?: string };
  const k = await createZapierKey(g.userId, (body.label || "Zapier").slice(0, 60));
  await markProviderVerified("zapier");
  return NextResponse.json(k);
}

export async function DELETE(req: NextRequest) {
  const g = await requireOwner(); if ("error" in g) return g.error;
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "id required" }, { status: 400 });
  await createSupabaseServiceClient().from("zapier_api_keys").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
