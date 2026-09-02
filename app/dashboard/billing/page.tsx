import { getCurrentCustomerContext } from "@/lib/dashboardData";

export default async function BillingPage() {
  const ctx = await getCurrentCustomerContext();
  const membership = ctx?.membership;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Billing</h1>
      <p className="text-medium-gray mb-10 max-w-[560px]">
        SFB Connect is a single annual payment — no monthly subscription.
      </p>

      <div className="glass rounded-[28px] p-10 max-w-[480px]">
        <div className="text-[13px] text-medium-gray font-mono uppercase mb-2">
          Plan
        </div>
        <div className="text-lg font-semibold mb-8">SFB Connect AI Presence — $200/year</div>

        <div className="text-[13px] text-medium-gray font-mono uppercase mb-2">
          Status
        </div>
        <div className="text-lg font-semibold mb-8 capitalize">
          {membership?.status || "—"}
        </div>

        <div className="text-[13px] text-medium-gray font-mono uppercase mb-2">
          Renews
        </div>
        <div className="text-lg font-semibold font-mono">
          {membership?.renews_at
            ? new Date(membership.renews_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            : "—"}
        </div>
      </div>
    </div>
  );
}
