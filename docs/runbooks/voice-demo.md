# Runbook — Live voice demo (branch agency-platform)
- Route: POST /api/demo/voice {trade} -> short-lived ElevenLabs signed URL + server-built prompt overrides. GET -> {configured}.
- Env: ELEVENLABS_API_KEY (required; Vercel Production + Preview), optional ELEVENLABS_VOICE_ID, ELEVENLABS_AGENT_ID, VOICE_DEMO_DAILY_SESSIONS (default 40).
- Agent: reused by name "SFB Connect Demo Receptionist" or created on first use (180 s max call, prompt + first_message overrides enabled).
- Caps: 4 sessions/hour/IP and the daily cap, both via agent_rate_limits; the call itself is limited to 180 s by the agent config and the client timer.
- Off switch: remove ELEVENLABS_API_KEY; the UI falls back to the labeled simulation.
- Troubleshooting: an 'Invalid API key' from ElevenLabs means the Vercel value has stray characters or is the wrong key; re-paste with nothing around it, tick Production + Preview, then redeploy (env changes only apply to new builds).
