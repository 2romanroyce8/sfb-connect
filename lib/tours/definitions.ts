// Guided tours — data only (Roman, 2026-10-12). A tour is an array of steps:
// target selector, title, body, placement, optional route to be on. New tours
// need no engine changes. Copy is short and direct; Roman reviews wording.

export type Placement = "auto" | "top" | "bottom" | "left" | "right";
export type TourStep = { id: string; target: string; title: string; body: string; placement?: Placement; route?: string };
export type TourDef = {
  key: string; name: string; description: string;
  /** Auto-start when the path matches (first entry only, unless replayed). */
  autoStart: (pathname: string) => boolean;
  steps: TourStep[];
};

const onb = (no: number, slug: string, title: string, body: string): TourStep => ({ id: `onb-${no}`, target: `[data-tour="onb-step-${no}"]`, route: `/dashboard/onboarding/${slug}`, title, body, placement: "auto" });

export const TOURS: Record<string, TourDef> = {
  onboarding: {
    key: "onboarding", name: "Onboarding guide", description: "What each of the 11 setup steps does and why it matters.",
    autoStart: (p) => p.startsWith("/dashboard/onboarding"),
    steps: [
      onb(1, "profile", "Start with the truth", "This is what your agent believes about your business. Fix anything that's off — every message starts from here, and nothing gets redone later."),
      onb(2, "gmail", "Connect the Gmail your business sends from", "The agent drafts, you approve, nothing sends without you. This is simply the address approved messages leave from."),
      onb(3, "calendar", "Connect the calendar calls should land on", "When a prospect says yes, the agent checks your real availability and books it with a Meet link."),
      onb(4, "brand", "Your logo and colors", "Pulled from your site. If the site doesn't expose a clean logo, upload one — it takes ten seconds."),
      onb(5, "capabilities", "Eight switches", "All included. Switch off anything you don't want the agent touching. Toggles are free; only completed work costs credits."),
      onb(6, "icp", "Who you want more of", "Industry, location, size. The lead list and every intro are built from this answer."),
      onb(7, "leads", "The agent finds them, you review", "Nothing is contacted until you've looked at the list."),
      onb(8, "automations", "Follow-ups on rails", "Sequences and templates come pre-filled. Every step still needs your approval before it sends."),
      onb(9, "dfy", "Want us to run it?", "Two done-for-you options, or keep going yourself — one click, no tricks."),
      onb(10, "campaign", "First campaign", "The agent drafts. You approve. It launches. That's the whole rhythm."),
      onb(11, "dashboard", "Watch your agent work", "The dashboard shows activity as it happens — this is where you'll live from here."),
    ],
  },
  dashboard: {
    key: "dashboard", name: "Dashboard tour", description: "Here's your agent at work: activity, credits, approvals, toggles, reports.",
    autoStart: (p) => p === "/dashboard",
    steps: [
      { id: "activity", target: '[data-tour="activity"]', title: "Here's your agent at work", body: "Every real action lands in this feed as it happens — scans, findings, sends, bookings, receipts.", placement: "auto" },
      { id: "credits", target: '[data-tour="agent-panel"]', title: "Credits", body: "Completed work costs credits; failed work costs none. Your balance and the latest receipts live here.", placement: "auto" },
      { id: "actions", target: '[data-tour="nav-actions"]', title: "Approval queue", body: "Anything waiting on you shows up under Actions — including campaign approvals once your first campaign starts.", placement: "right" },
      { id: "toggles", target: '[data-tour="nav-agent"]', title: "Toggles", body: "The eight capabilities and their live status. Switch anything on or off any time.", placement: "right" },
      { id: "reports", target: '[data-tour="nav-reports"]', title: "Reports", body: "What changed, in plain language, on a schedule you can share.", placement: "right" },
    ],
  },
};
export const tour = (key: string | null | undefined): TourDef | null => (key ? TOURS[key] ?? null : null);

// ---------- pure helpers (tested) ----------
export type Rect = { top: number; left: number; width: number; height: number };
export type Viewport = { width: number; height: number };
export const MOBILE_MAX = 640;
export const CARD_W = 320; export const CARD_H = 170; export const GAP = 12;

/** Where the tooltip card goes for a target rect. "auto" prefers below, then above, then right, then left; always clamped into the viewport. */
export function placeTooltip(target: Rect, vp: Viewport, placement: Placement = "auto"): { top: number; left: number; side: Exclude<Placement, "auto"> } {
  const fits = { bottom: target.top + target.height + GAP + CARD_H <= vp.height, top: target.top - GAP - CARD_H >= 0, right: target.left + target.width + GAP + CARD_W <= vp.width, left: target.left - GAP - CARD_W >= 0 };
  const order: Exclude<Placement, "auto">[] = placement === "auto" ? ["bottom", "top", "right", "left"] : [placement, "bottom", "top", "right", "left"];
  const side = order.find((s) => fits[s]) ?? "bottom";
  let top: number; let left: number;
  if (side === "bottom") { top = target.top + target.height + GAP; left = target.left + target.width / 2 - CARD_W / 2; }
  else if (side === "top") { top = target.top - GAP - CARD_H; left = target.left + target.width / 2 - CARD_W / 2; }
  else if (side === "right") { top = target.top + target.height / 2 - CARD_H / 2; left = target.left + target.width + GAP; }
  else { top = target.top + target.height / 2 - CARD_H / 2; left = target.left - GAP - CARD_W; }
  left = Math.max(GAP, Math.min(left, vp.width - CARD_W - GAP));
  top = Math.max(GAP, Math.min(top, vp.height - CARD_H - GAP));
  return { top, left, side };
}

/** Next step index at or after `from` whose target is present; -1 when none. `present` answers "is this selector in the DOM right now". */
export function nextPresentStep(steps: TourStep[], from: number, present: (step: TourStep) => boolean, dir: 1 | -1 = 1): number {
  for (let i = from; i >= 0 && i < steps.length; i += dir) if (present(steps[i])) return i;
  return -1;
}

export const progressLabel = (index: number, total: number) => `${index + 1} of ${total}`;
export const isMobile = (vp: Viewport) => vp.width < MOBILE_MAX;
