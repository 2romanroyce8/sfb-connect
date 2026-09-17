// Fire-and-forget event tracking for the public pricing page. Real (writes
// to marketing_events), not a stub -- but intentionally silent on failure
// since a tracking call must never block or break the user's actual click.
export function trackMarketingEvent(eventName: string, detail?: Record<string, unknown>) {
  fetch("/api/marketing-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventName, detail }),
  }).catch(() => {});
}
