import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";

/** Pricing is gated (Roman, 2026-10-12): it is shown only inside /start after email verification and the build show. The public URL sends people there. */
export default function PricingPage() {
  redirect("/start");
}
