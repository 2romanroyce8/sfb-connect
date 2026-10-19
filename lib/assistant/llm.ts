// Layer 2/3 seam: the conversational brain is a config value, not hardcoded.
// ASSISTANT_LLM_PROVIDER = "none" (default, Layer 1 only) | "gemini" (free tier, Layer 2 — not wired yet)
// | "openai_compatible" (local model / Ollama-style endpoint later). No provider makes a network call today.
import type { Reply } from "./types";

export type LlmProvider = "none" | "gemini" | "openai_compatible";
export const llmProvider = (): LlmProvider => { const p = (process.env.ASSISTANT_LLM_PROVIDER ?? "none").toLowerCase(); return p === "gemini" || p === "openai_compatible" ? p : "none"; };

/** Layer 2 entry point. Returns null when no provider is configured (or it's rate-limited) → caller falls back to Layer 1 help. */
export async function askLlm(_input: { role: "team" | "client"; message: string }): Promise<Reply | null> {
  if (llmProvider() === "none") return null;
  return null; // Layer 2 ships next; until then every provider degrades to Layer 1.
}
