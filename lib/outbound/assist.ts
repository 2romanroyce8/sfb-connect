// Editing assistance on the customer's OWN draft ("make it shorter", "make it
// friendlier"). This is the first inference in the outbound path and it is
// opt-in per request: it never drafts from nothing, never adds facts, and the
// result goes back into the editor — still through the same approval queue
// before anything sends. Needs ANTHROPIC_API_KEY; without it the route says so.
import { validateSource } from "./templates";

export const ASSIST_INSTRUCTIONS = [
  { key: "shorter", label: "Make it shorter", prompt: "Cut it to roughly half the length. Keep the ask." },
  { key: "friendlier", label: "Make it friendlier", prompt: "Warmer and more human, same content, no exclamation marks." },
  { key: "direct", label: "More direct", prompt: "Lead with the point. Remove softeners and throat-clearing." },
  { key: "formal", label: "More formal", prompt: "Professional register, full sentences, no slang. Same content." },
  { key: "fix", label: "Fix grammar only", prompt: "Correct spelling, grammar and punctuation. Change nothing else." },
] as const;
export type AssistKey = (typeof ASSIST_INSTRUCTIONS)[number]["key"];

export function assistConfigured() { return !!process.env.ANTHROPIC_API_KEY; }

/** Pure: the edited draft must keep every placeholder the original used (no variable invented, none dropped) and introduce no unknown ones. */
export function checkAssistResult(original: { subject: string; body: string }, edited: { subject: string; body: string }): string | null {
  const vars = (s: string) => new Set(Array.from(`${s}`.matchAll(/\{\{([^{}]+)\}\}/g)).map((m) => m[1].trim().toLowerCase()));
  const o = vars(`${original.subject}\n${original.body}`), e = vars(`${edited.subject}\n${edited.body}`);
  for (const k of o) if (!e.has(k)) return `The edit dropped {{${k}}} — kept your original.`;
  for (const k of e) if (!o.has(k)) return `The edit added {{${k}}}, which you didn't use — kept your original.`;
  const bad = validateSource(edited); if (bad.length) return `Unknown placeholder ${bad.map((b) => `{{${b}}}`).join(", ")} — kept your original.`;
  if (!edited.subject.trim() || !edited.body.trim()) return "The edit came back empty — kept your original.";
  return null;
}

export async function assistEdit(draft: { subject: string; body: string }, instruction: AssistKey, fetchImpl: typeof fetch = fetch): Promise<{ subject: string; body: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Editing help isn't switched on for this deployment yet (no AI provider key). You can still edit by hand.");
  const ins = ASSIST_INSTRUCTIONS.find((i) => i.key === instruction) ?? ASSIST_INSTRUCTIONS[0];
  const system = `You edit a short outreach email written by a small-business owner. Rules: keep every {{placeholder}} exactly as written and add none; add no facts, claims, numbers, names or links that are not already in the draft; keep the sender's meaning and intent; plain text only; English. Return ONLY JSON: {"subject": "...", "body": "..."}.`;
  const r = await fetchImpl("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1024, system, messages: [{ role: "user", content: `Instruction: ${ins.prompt}\n\nSubject: ${draft.subject}\n\nBody:\n${draft.body}` }] }) });
  const j = (await r.json().catch(() => ({}))) as { content?: { text?: string }[]; error?: { message?: string } };
  if (!r.ok) throw new Error(j.error?.message || `Editing help failed (${r.status}).`);
  const text = j.content?.map((c) => c.text ?? "").join("") ?? "";
  const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error("Editing help returned something unexpected — kept your original.");
  let edited: { subject?: string; body?: string }; try { edited = JSON.parse(m[0]); } catch { throw new Error("Editing help returned something unexpected — kept your original."); }
  const out = { subject: String(edited.subject ?? "").trim(), body: String(edited.body ?? "").trim() };
  const problem = checkAssistResult(draft, out); if (problem) throw new Error(problem);
  return out;
}
