import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getStripeClient, isStripeConfigured } from "./stripe";

export type InvoiceRow = { id: string; number: string | null; createdAt: string; amountPaidCents: number; status: string; hostedUrl: string | null; pdfUrl: string | null; description: string | null };

/**
 * The customer's real Stripe invoices (plan + renewals). Read-only; returns []
 * when Stripe isn't configured or the business has no Stripe customer yet
 * (trial), so the Billing tab never shows a fabricated history.
 */
export async function listInvoices(businessId: string, limit = 12): Promise<InvoiceRow[]> {
  if (!isStripeConfigured()) return [];
  const service = createSupabaseServiceClient();
  const { data: b } = await service.from("businesses").select("stripe_customer_id").eq("id", businessId).maybeSingle();
  const customer = (b?.stripe_customer_id as string | null) ?? null;
  if (!customer) return [];
  try {
    const stripe = getStripeClient();
    const r = await stripe.invoices.list({ customer, limit });
    return r.data.map((inv) => ({
      id: inv.id, number: inv.number ?? null, createdAt: new Date(inv.created * 1000).toISOString(), amountPaidCents: inv.amount_paid ?? 0,
      status: inv.status ?? "unknown", hostedUrl: inv.hosted_invoice_url ?? null, pdfUrl: inv.invoice_pdf ?? null,
      description: inv.lines?.data?.[0]?.description ?? null,
    }));
  } catch (e) {
    console.error("[billing] invoices.list failed:", e instanceof Error ? e.message : e);
    return [];
  }
}
