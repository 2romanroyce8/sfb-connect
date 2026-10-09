import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data: biz } = await supabase.from("businesses").select("id").eq("owner_id", user.id).not("plan_key", "is", null).maybeSingle();
  if (!biz) return NextResponse.json({ error: "No business" }, { status: 404 });
  const { data } = await supabase.from("credit_transactions").select("created_at, type, amount, balance_after, description, capability_key, action_key").eq("business_id", biz.id).order("created_at");
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = ["created_at,type,amount,balance_after,description,capability,action", ...(data ?? []).map((r) => [r.created_at, r.type, r.amount, r.balance_after, r.description, r.capability_key, r.action_key].map(esc).join(","))].join("\n");
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="sfb-credits-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
