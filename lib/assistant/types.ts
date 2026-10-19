// Shared reply shape for the dashboard assistant (team + client).
export type Item = { label: string; sub?: string; href?: string };
export type Reply = {
  text: string;
  items?: Item[];
  links?: { label: string; href: string }[];
  options?: { label: string; message: string }[];       // tap to send (disambiguation, next steps)
  confirm?: { summary: string; token: string; action: PendingAction; cost?: string }; // writes wait for this
  suggestions?: string[];
  source?: "router" | "llm" | "fallback";
};
export type PendingAction = { intent: string; args: Record<string, string | number | null> };
