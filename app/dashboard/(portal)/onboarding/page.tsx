import { redirect } from "next/navigation";
import { getCustomerContext } from "@/lib/customerPortal/context";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { loadOnboarding } from "@/lib/onboarding/state";
import { stepByNo } from "@/lib/onboarding/flow";
export const dynamic = "force-dynamic";

/** Resume: land on the first unfinished, unlocked step. */
export default async function OnboardingIndex() {
  const result = await getCustomerContext("/dashboard/onboarding");
  if (result.status === "no_customer") redirect("/dashboard/no-membership");
  const { state } = await loadOnboarding(createSupabaseServiceClient(), result.context.business.id);
  redirect(`/dashboard/onboarding/${stepByNo(state.current)!.slug}`);
}
