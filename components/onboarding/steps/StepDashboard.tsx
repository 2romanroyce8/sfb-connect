"use client";

import AgentFeed from "@/components/customerPortal/AgentFeed";
import type { FeedItem } from "@/lib/customerPortal/agentFeed";

/** Step 11 — the live feed, then hand the customer their dashboard. */
export default function StepDashboard({ feed, onConfirm }: { feed: FeedItem[]; onConfirm: () => Promise<void> }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="border border-neutral-200 rounded-2xl p-6">
        <div className="text-[15px] font-medium text-neutral-900">This is where you&apos;ll live from here.</div>
        <p className="text-[13.5px] text-neutral-600 mt-2">Every action your agent takes shows up as a line below — what it did, whether you approved it, what it cost. Drafts waiting for you are marked <em>Needs you</em>. Nothing in this list is ever made up; if it&apos;s empty, the agent hasn&apos;t acted yet.</p>
      </div>
      <AgentFeed items={feed} title="Live activity" />
      <div className="flex items-center gap-3"><button onClick={() => void onConfirm()} className="h-[44px] px-6 rounded-full bg-neutral-900 text-white text-[14px] font-semibold">Go to my dashboard →</button><span className="text-[12.5px] text-neutral-400">Setup complete. You can revisit any step from Settings.</span></div>
    </div>
  );
}
