import { SUPPORT_EMAIL } from "@/lib/site";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * An authenticated user with no business that has a plan. With the gated
 * funnel this is almost always someone who hasn't finished onboarding yet —
 * so the way forward is /start, which resumes at their exact step. Lives
 * outside the (portal) route group so it can never render portal content.
 */
export default async function NoMembershipPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");
  const { data: business } = await supabase.from("businesses").select("id").eq("owner_id", user.id).not("plan_key", "is", null).limit(1).maybeSingle();
  if (business) redirect("/dashboard");
  return (
    <main className="min-h-screen bg-white text-neutral-900 flex items-center justify-center px-6" data-authored="light">
      <div className="w-full max-w-[440px] text-center">
        <div className="text-[13px] font-semibold tracking-[0.08em] text-neutral-500 mb-8">SFB CONNECT</div>
        <h1 className="text-[22px] font-semibold text-neutral-900 mb-3">Finish setting up your agent</h1>
        <p className="text-[14px] leading-relaxed text-neutral-500 mb-10">Your account exists, but onboarding isn&apos;t finished. Pick up where you left off — your details and anything your agent already learned are saved. If you just paid, your dashboard unlocks within a minute.</p>
        <div className="flex flex-col gap-3">
          <Link href="/start" className="w-full h-11 rounded-full bg-neutral-900 text-white text-[13.5px] font-medium flex items-center justify-center">Continue setup</Link>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="w-full h-11 rounded-full border border-neutral-200 text-neutral-700 text-[13.5px] font-medium flex items-center justify-center">Contact Support</a>
        </div>
      </div>
    </main>
  );
}
