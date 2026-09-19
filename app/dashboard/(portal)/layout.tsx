import { redirect } from "next/navigation";
import { getCustomerContext } from "@/lib/customerPortal/context";
import PortalShell from "@/components/customerPortal/PortalShell";

/**
 * The ONE place that gates every real customer-portal page (Overview,
 * Billing, Support, and everything added in later phases). Uses the
 * (portal) route group so /dashboard/no-membership -- the honest fallback
 * for an authenticated non-customer -- lives OUTSIDE this gate entirely,
 * rather than risking a layout that redirects to a route nested under
 * itself.
 *
 * getCustomerContext() itself redirects unauthenticated visitors to
 * /login?next=... A "no_customer" result here means: real Supabase
 * session, but no businesses row with a plan_key owned by them -- that
 * must never render portal content, so we redirect to the dedicated
 * no-membership page instead of rendering {children} at all.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const result = await getCustomerContext("/dashboard");

  if (result.status === "no_customer") {
    redirect("/dashboard/no-membership");
  }

  const { context } = result;

  return (
    <PortalShell
      businessName={context.business.legalName}
      planLabel={context.planLabel}
      displayName={context.firstName || context.email || "Account"}
    >
      {children}
    </PortalShell>
  );
}
