import { BASE_AGENT_NAME, BASE_PROMPT } from "./voicePrompt";

// Server-only. The key comes from ELEVENLABS_API_KEY (Vercel env); it is never sent to the browser or logged.
const API = "https://api.elevenlabs.io/v1";
const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";
export const voiceConfigured = () => !!process.env.ELEVENLABS_API_KEY;
const h = () => ({ "xi-api-key": process.env.ELEVENLABS_API_KEY as string, "content-type": "application/json" });

async function j(r: Response) { const t = await r.text(); try { return JSON.parse(t); } catch { return { raw: t.slice(0, 300) }; } }

/** Reuses an agent with our name, or creates one (max 3-minute calls, per-session prompt overrides allowed). */
export async function ensureAgent(): Promise<string> {
  if (process.env.ELEVENLABS_AGENT_ID) return process.env.ELEVENLABS_AGENT_ID;
  const list = await j(await fetch(`${API}/convai/agents?search=${encodeURIComponent(BASE_AGENT_NAME)}&page_size=30`, { headers: h() }));
  const found = (list.agents ?? []).find((a: { name: string }) => a.name === BASE_AGENT_NAME);
  if (found) return found.agent_id as string;
  const created = await j(await fetch(`${API}/convai/agents/create`, {
    method: "POST", headers: h(),
    body: JSON.stringify({
      name: BASE_AGENT_NAME,
      conversation_config: {
        agent: { prompt: { prompt: BASE_PROMPT }, first_message: "Thanks for calling. How can I help you today?", language: "en" },
        tts: { voice_id: process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE },
        conversation: { max_duration_seconds: 180 },
      },
      platform_settings: { overrides: { conversation_config_override: { agent: { prompt: { prompt: true }, first_message: true } } } },
    }),
  }));
  if (!created.agent_id) throw new Error(`agent create failed: ${JSON.stringify(created).slice(0, 300)}`);
  return created.agent_id as string;
}

/** Idempotent: makes sure this agent accepts per-call prompt and first-message overrides (and caps calls at 180 s). Throws with the upstream message if ElevenLabs refuses. */
export async function ensureOverrides(agentId: string): Promise<void> {
  const r = await fetch(`${API}/convai/agents/${encodeURIComponent(agentId)}`, {
    method: "PATCH", headers: h(),
    body: JSON.stringify({
      conversation_config: { conversation: { max_duration_seconds: 180 } },
      platform_settings: { overrides: { conversation_config_override: { agent: { prompt: { prompt: true }, first_message: true, language: false } }, enable_conversation_initiation_client_data_from_webhook: false } },
    }),
  });
  if (!r.ok) throw new Error(`agent patch failed (${r.status}): ${JSON.stringify(await j(r)).slice(0, 300)}`);
}

export async function signedUrl(agentId: string): Promise<string> {
  const r = await j(await fetch(`${API}/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`, { headers: h() }));
  if (!r.signed_url) throw new Error(`signed url failed: ${JSON.stringify(r).slice(0, 300)}`);
  return r.signed_url as string;
}
