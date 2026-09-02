import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Payment } from "@/lib/types";

/**
 * The signed-in user's most recent payment submission, if any. Drives the
 * /pay page (show instructions vs. pending vs. confirmed) and gates
 * /onboarding (only reachable once a payment is confirmed).
 */
export async function getCurrentUserPayment(): Promise<Payment | null> {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("payments")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as Payment) || null;
}

export const ANNUAL_AMOUNT_CENTS = 20000;

export const PAYMENT_CONTACTS = {
  cashapp: process.env.NEXT_PUBLIC_CASHAPP_TAG || "$SFBConnect",
  paypal: process.env.NEXT_PUBLIC_PAYPAL_CONTACT || "paypal.me/SFBConnect",
  zelle: process.env.NEXT_PUBLIC_ZELLE_CONTACT || "payments@sfbconnect.com",
};
