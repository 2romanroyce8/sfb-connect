import OnboardingWizard from "@/components/onboarding/OnboardingWizard";

// Middleware already requires auth for this route. Onboarding used to be
// additionally gated behind a confirmed manual Cash App / PayPal / Zelle
// payment, but that self-serve checkout flow has been removed in favor of a
// demo-first sales process — customers are onboarded after a booked demo,
// not an automated payment confirmation.
export default async function OnboardingPage() {
  return <OnboardingWizard />;
}
