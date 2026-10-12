"use client";

/** Steps 2 and 3 — the two hard gates. State comes from the real connection row; nothing to "confirm". */
export default function StepConnect({ kind, account, done, onNext }: { kind: "gmail" | "calendar"; account: string | null; done: boolean; onNext: () => void }) {
  const gmail = kind === "gmail";
  const href = gmail ? "/api/team/integrations/gmail/connect?return=onboarding" : "/api/team/integrations/google/connect?return=onboarding";
  return (
    <div className="border border-neutral-200 rounded-2xl p-6">
      <div className="text-[15px] font-medium text-neutral-900">{gmail ? "Your agent sends outreach from your own Gmail address." : "Your agent books calls straight onto your Google Calendar."}</div>
      <p className="text-[13.5px] text-neutral-600 mt-2">{gmail
        ? "Every message still goes through your approval first — Gmail is how an approved message leaves. Replies land in your inbox like any other email, and your agent reads them to keep the thread going. We ask for send + read access on this one account; the token is stored encrypted and never shown."
        : "When a prospect says yes, your agent checks your real availability and puts the meeting (with a Meet link) on your calendar. We ask for calendar access on this one account; the token is stored encrypted and never shown."}</p>
      <div className="mt-5 flex items-center gap-3 flex-wrap">
        {done ? (
          <>
            <span className="inline-flex items-center gap-2 text-[13.5px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5">✓ Connected{account ? ` as ${account}` : ""}</span>
            <button onClick={onNext} className="h-[44px] px-6 rounded-full bg-neutral-900 text-white text-[14px] font-semibold">Continue →</button>
            <a href={href} className="text-[12.5px] text-neutral-500 underline underline-offset-2">Use a different account</a>
          </>
        ) : (
          <>
            <a href={href} className="h-[44px] px-6 rounded-full bg-neutral-900 text-white text-[14px] font-semibold inline-flex items-center">{gmail ? "Connect Gmail" : "Connect Google Calendar"}</a>
            <span className="text-[12.5px] text-amber-700">Required — your agent can&apos;t {gmail ? "send" : "book"} without it.</span>
          </>
        )}
      </div>
    </div>
  );
}
