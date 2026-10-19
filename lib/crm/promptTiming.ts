// Queue timing for the Give HyperAgent tab: live "in queue for 2h 14m" on
// queued cards, frozen "sent after 3h 22m in queue" on sent ones. Pure.

/** 0–59 s → "under 1m"; then "14m", "2h 14m", "3d 4h". */
export function formatAge(ms: number): string {
  if (!Number.isFinite(ms) || ms < 60_000) return "under 1m";
  const m = Math.floor(ms / 60_000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

/** How long a queued card has waited, as of `now`. */
export const queuedFor = (createdAt: string, now: number) => Math.max(0, now - Date.parse(createdAt));

/** Total wait for a sent card (frozen at sent_at). Null if it has no sent time. */
export const waitedBeforeSend = (createdAt: string, sentAt: string | null) => (sentAt ? Math.max(0, Date.parse(sentAt) - Date.parse(createdAt)) : null);

export const POLL_MS = 60_000;
