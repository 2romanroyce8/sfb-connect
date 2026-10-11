import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { pendingTrialOrder } from "@/lib/agentProgram/trial";
import TrialResume from "@/components/agent/TrialResume";
import { TRIAL_TIER, fmtUsd } from "@/lib/agentProgram/config";

/**
 * The honest fallback for an authenticated Supabase user who is NOT an
 * authorized SFB Connect customer (no businesses row with a plan_key owned
 * by them). Deliberately lives outside the (portal) route group's gated
 * layout so it can never accidentally render portal content, and outside
 * any redirect loop with that layout.
 *
 * If this page is reached by someone who actually IS a valid customer
 * (shouldn't happen, but defensive), send them to the real dashboard
 * rather than stranding them here.
 */
export default async function NoMembershipPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/dashboard");

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .not("plan_key", "is", null)
    .limit(1)
    .maybeSingle();

  if (business) redirect("/dashboard");
  // An account whose $1 trial checkout never finished: offer to finish it right here.
  const pendingTrial = await pendingTrialOrder(createSupabaseServiceClient(), user.id);

  return (
    <main className="min-h-screen bg-white text-neutral-900 flex items-center justify-center px-6">
      <div className="w-full max-w-[440px] text-center">
        <div className="text-[13px] font-semibold tracking-[0.08em] text-neutral-500 mb-8">SFB CONNECT</div>
        <h1 className="text-[22px] font-semibold text-neutral-900 mb-3">{pendingTrial ? "Finish your trial checkout" : "No Active SFB Membership"}</h1>
        <p className="text-[14px] leading-relaxed text-neutral-500 mb-10">
          {pendingTrial
            ? `Your account and trial setup are saved. The ${fmtUsd(TRIAL_TIER.trialUsd)} checkout wasn't completed, so your agent hasn't started yet — finish it and your ${TRIAL_TIER.trialDays} days begin the moment it clears.`
            : <>We couldn&apos;t find an active SFB Connect plan tied to this account. If you recently purchased a plan, it may still be getting set up -- otherwise, reach out and we&apos;ll help sort it out.</>}
        </p>
        <div className="flex flex-col gap-3">
          {pendingTrial && <TrialResume dark={false} />}
          <a
            href="mailto:support@sfbconnect.com"
            className="w-full h-11 rounded-full bg-neutral-900 text-white text-[13.5px] font-medium flex items-center justify-center"
          >
            Contact Support
          </a>
          <Link
            href="/"
            className="w-full h-11 rounded-full border border-neutral-200 text-neutral-700 text-[13.5px] font-medium flex items-center justify-center"
          >
            Return to SFBConnect.com
          </Link>
        </div>
      </div>
    </main>
  );
}
