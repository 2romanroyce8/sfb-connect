"use client";

import Link from "next/link";
import type { StepDef } from "@/lib/onboarding/flow";

/** Steps shipping in the next release. Honest: says so, keeps progress, offers the dashboard. */
export default function StepNotYet({ step, onNext, hasNext }: { step: StepDef; onNext: () => void; hasNext: boolean }) {
  return (
    <div className="border border-neutral-200 rounded-2xl p-6">
      <div className="text-[15px] font-medium text-neutral-900">{step.title} is next in line.</div>
      <p className="text-[13.5px] text-neutral-600 mt-2">This step isn&apos;t live yet — today&apos;s release covers steps 1–8. Everything you&apos;ve done is saved, and this step will appear here (and in your dashboard checklist) the moment it ships. In the meantime your team at SFB Connect can run it with you: <a href="mailto:hello@sfbconnect.com" className="underline">hello@sfbconnect.com</a>.</p>
      <div className="mt-5 flex items-center gap-3 flex-wrap">
        {hasNext && <button onClick={onNext} className="h-[40px] px-5 rounded-full border border-neutral-300 text-[13.5px] font-medium">Skip ahead</button>}
        <Link href="/dashboard" className="h-[40px] px-5 rounded-full bg-neutral-900 text-white text-[13.5px] font-semibold inline-flex items-center">Go to dashboard</Link>
      </div>
    </div>
  );
}
