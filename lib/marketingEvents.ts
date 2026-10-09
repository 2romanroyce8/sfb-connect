// Fire-and-forget event tracking for the public site. Real (writes to
// marketing_events), not a stub -- and intentionally silent on failure since
// a tracking call must never block or break the user's actual click.
// keepalive: most of these fire on links that navigate immediately; without
// it the browser cancels the request on unload and the event is lost.
export function trackMarketingEvent(eventName: string, detail?: Record<string, unknown>) {
  try {
    const body = JSON.stringify({ eventName, detail });
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      navigator.sendBeacon("/api/marketing-events", new Blob([body], { type: "application/json" }));
      return;
    }
    fetch("/api/marketing-events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch { /* never surface */ }
}
