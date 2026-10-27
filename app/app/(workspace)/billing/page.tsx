import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { getAgencyContext } from "@/lib/agency/context";
import { billingEnabled } from "@/lib/agency/billing";
import { getStripeClient } from "@/lib/billing/stripe";
import BillingPanel from "@/components/agency/BillingPanel";
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const r = await getAgencyContext(); if (r.status !== "ok") return null;
  const enabled = billingEnabled();
  let { data: row } = await createSupabaseServerClient().from("agency_billing").select("subscription_status, current_period_end, cancel_at_period_end, connect_account_id, connect_charges_enabled, connect_payouts_enabled, connect_details_submitted").eq("agency_id", r.ctx.agencyId).maybeSingle();
  // Connect status is read live from Stripe (no webhook needed), then stored for the rest of the app.
  if (enabled && row?.connect_account_id) {
    try { const a = await getStripeClient().accounts.retrieve(row.connect_account_id as string); const next = { connect_charges_enabled: !!a.charges_enabled, connect_payouts_enabled: !!a.payouts_enabled, connect_details_submitted: !!a.details_submitted };
      await createSupabaseServiceClient().from("agency_billing").update({ ...next, updated_at: new Date().toISOString() }).eq("agency_id", r.ctx.agencyId); row = { ...row, ...next }; } catch { /* show last stored status */ }
  }
  return <div className="px-8 py-8 max-w-[860px]"><h1 className="text-[24px] font-semibold tracking-tight">Billing</h1><BillingPanel enabled={enabled} canManage={["owner", "admin"].includes(r.ctx.role)} row={(row ?? null) as never} /></div>;
}
