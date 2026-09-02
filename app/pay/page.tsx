import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserPayment, PAYMENT_CONTACTS, ANNUAL_AMOUNT_CENTS } from "@/lib/paymentsData";
import PayFlow from "@/components/pay/PayFlow";
import CreateAccountGate from "@/components/pay/CreateAccountGate";

export default async function PayPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const amountDisplay = `$${(ANNUAL_AMOUNT_CENTS / 100).toFixed(0)}`;

  return (
    <main className="min-h-screen bg-black text-white px-6 py-16">
      <div className="max-w-[560px] mx-auto">
        <div className="font-extrabold text-lg mb-3 text-center">
          SFB <span className="text-medium-gray font-semibold">CONNECT</span>
        </div>
        <p className="text-center text-medium-gray text-sm mb-10">
          SFB Connect AI Presence — {amountDisplay}/year, no monthly subscription.
        </p>

        {!user ? (
          <CreateAccountGate />
        ) : (
          <div className="glass rounded-[28px] p-9">
            <PayFlow
              initialPayment={await getCurrentUserPayment()}
              contacts={PAYMENT_CONTACTS}
              amountDisplay={amountDisplay}
            />
          </div>
        )}
      </div>
    </main>
  );
}
