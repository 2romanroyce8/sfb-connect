import { SUPPORT_EMAIL } from "@/lib/site";
import Link from "next/link";
import { CUSTOMER_DENIED_COPY } from "@/lib/google/gate";

/**
 * Backstop landing page: Google answered access_denied to a customer who
 * somehow reached the consent screen before being cleared. Google's own text
 * is never shown; the team has already been alerted by the callback.
 */
export default function GoogleNotClearedPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900 flex items-center justify-center px-6">
      <div className="max-w-[520px] w-full border border-neutral-200 rounded-2xl p-8">
        <div className="text-[11px] uppercase tracking-[0.14em] text-neutral-500 mb-2">Google connection</div>
        <h1 className="text-[24px] font-semibold tracking-tight">Almost there.</h1>
        <p className="text-[14.5px] text-neutral-600 mt-3 leading-relaxed">{CUSTOMER_DENIED_COPY}</p>
        <p className="text-[13px] text-neutral-500 mt-3">Nothing else is needed from you. You&apos;ll get an email the moment the connection is ready, and your setup progress is saved.</p>
        <div className="mt-6 flex items-center gap-3 flex-wrap">
          <Link href="/dashboard/onboarding" className="h-[42px] px-5 rounded-full bg-neutral-900 text-white text-[14px] font-semibold inline-flex items-center">Back to setup</Link>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[13px] text-neutral-600 underline underline-offset-2">Email us</a>
        </div>
      </div>
    </main>
  );
}
