import { redirect } from "next/navigation";
import { getCurrentUserPayment } from "@/lib/paymentsData";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";

export default async function OnboardingPage() {
  const payment = await getCurrentUserPayment();

  // Middleware already requires auth for this route; this gate additionally
  // requires that the manually-submitted Cash App / PayPal / Zelle payment
  // has been confirmed by an admin before the intake wizard is reachable.
  if (!payment || payment.status !== "confirmed") {
    redirect("/pay");
  }

  return <OnboardingWizard />;
}
