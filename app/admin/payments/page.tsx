import { listPaymentsForAdmin } from "@/lib/adminPaymentsData";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/types";
import PaymentReviewControls from "@/components/admin/PaymentReviewControls";

const STATUS_STYLE: Record<string, string> = {
  pending_review: "bg-yellow-400/15 text-yellow-300",
  confirmed: "bg-green-400/15 text-green-300",
  rejected: "bg-red-400/15 text-red-300",
};

export default async function AdminPaymentsPage() {
  const payments = await listPaymentsForAdmin();
  const pending = payments.filter((p: any) => p.status === "pending_review");
  const reviewed = payments.filter((p: any) => p.status !== "pending_review");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Payments</h1>
      <p className="text-medium-gray mb-8">
        Cash App, PayPal, and Zelle have no merchant webhook — confirm each
        submission here only after verifying the reference code against
        money that has actually landed in the account.
      </p>

      <h2 className="text-sm font-mono uppercase text-medium-gray mb-4">
        Pending Review ({pending.length})
      </h2>
      <div className="flex flex-col gap-4 mb-12">
        {pending.length === 0 && (
          <div className="glass rounded-2xl p-6 text-medium-gray text-sm">Nothing waiting on review.</div>
        )}
        {pending.map((p: any) => (
          <div key={p.id} className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-lg font-semibold">{p.reference_code}</span>
                <span className={`text-[11px] font-mono uppercase px-2.5 py-1 rounded-full ${STATUS_STYLE[p.status]}`}>
                  {PAYMENT_STATUS_LABELS[p.status as keyof typeof PAYMENT_STATUS_LABELS]}
                </span>
              </div>
              <span className="text-sm text-medium-gray">
                ${(p.amount_cents / 100).toFixed(2)} via {PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS]}
              </span>
            </div>
            <div className="text-sm text-medium-gray mb-1">{p.users?.email}</div>
            <div className="text-[12px] text-medium-gray font-mono mb-3">
              Submitted {new Date(p.created_at).toLocaleString()}
            </div>
            {p.customer_note && (
              <div className="text-sm mb-2">
                <span className="text-medium-gray">Note: </span>{p.customer_note}
              </div>
            )}
            {p.proof_screenshot_url && (
              <a href={p.proof_screenshot_url} target="_blank" rel="noopener noreferrer" className="text-sm underline block mb-2">
                View screenshot link
              </a>
            )}
            <PaymentReviewControls paymentId={p.id} />
          </div>
        ))}
      </div>

      <h2 className="text-sm font-mono uppercase text-medium-gray mb-4">
        Reviewed ({reviewed.length})
      </h2>
      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-medium-gray text-[12px] font-mono uppercase border-b border-white/10">
              <th className="px-5 py-3">Reference</th>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Method</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Reviewed</th>
            </tr>
          </thead>
          <tbody>
            {reviewed.map((p: any) => (
              <tr key={p.id} className="border-b border-white/5">
                <td className="px-5 py-4 font-mono">{p.reference_code}</td>
                <td className="px-5 py-4 text-medium-gray">{p.users?.email}</td>
                <td className="px-5 py-4">{PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS]}</td>
                <td className="px-5 py-4">
                  <span className={`text-[11px] font-mono uppercase px-2.5 py-1 rounded-full ${STATUS_STYLE[p.status]}`}>
                    {PAYMENT_STATUS_LABELS[p.status as keyof typeof PAYMENT_STATUS_LABELS]}
                  </span>
                </td>
                <td className="px-5 py-4 text-medium-gray font-mono text-[13px]">
                  {p.reviewed_at ? new Date(p.reviewed_at).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
            {reviewed.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-medium-gray">
                  Nothing reviewed yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
