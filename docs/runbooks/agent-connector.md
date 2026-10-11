# Runbook — Agent connector (OAuth, tokens, delegated sessions)

The connector is how Muse (Atlas) and HyperAgent act inside SFB Connect: `https://www.sfbconnect.com/api/v1/agent/mcp` (MCP) and `/api/v1/agent/*` (REST). An agent never holds a user's password or cookies — it holds an OAuth grant from a user, and every data call runs as that user under RLS.

## Pieces
| Piece | File |
|---|---|
| OAuth server (metadata, authorize, approve, token, revoke) | `lib/agent/oauth.ts`, `app/api/v1/agent/oauth/*` |
| Token store (SHA-256 hashes only, rotation, reuse detection) | `lib/agent/store.ts` — `issueTokenPair`, `rotateRefreshToken`, `classifyRefreshPresentation`, `lookupAccessToken` |
| Delegated Supabase session (acts as the user; RLS applies) | `lib/agent/delegatedSession.ts` — `mintDelegatedSession`, `getDelegatedAccessToken`, `resolveDelegatedUserClient`, `signOutDelegatedSession` |
| Request auth + rate limit | `lib/agent/auth.ts` — `authenticateAgent` (120 req/min per authorization) |
| Scopes | `lib/agent/scopes.ts` — `GRANTABLE_SCOPES` (what the approve screen offers), `WRITE_SCOPES` |
| Tools | `lib/agent/tools.ts` (+ `tasks/tools.ts`, `outboundTools.ts`) |
| Audit | `agent_audit_log` — Settings → Connected Agents → activity log |
| Tables | `agent_clients`, `agent_authorizations`, `agent_tokens`, `agent_audit_log`, `agent_browser_handoffs` |

## Token model
- Access token: 1 h, opaque, hashed at rest. Refresh token: 30 d, single-use, rotated on every `/oauth/token grant_type=refresh_token` call.
- Rotation records the successor on the old row (`agent_tokens.replaced_by_hash`) and sets `revoked_at`.
- **Grace window (`REFRESH_REUSE_GRACE_SEC` = 120 s).** Presenting an already-rotated refresh token within 120 s of its rotation is treated as a client retry (network blip, parallel refreshes): a brand-new pair is issued and audited as `token_refreshed_grace_replay`. Presenting it *after* the window is treated as theft: `refresh_token_reuse` → the whole authorization is revoked (`revokeAuthorizationFully`) and the agent must re-authorize. A refresh token revoked by authorization revocation (no successor) is never replayed.
- Why: on 2026-10-07/10/11 Muse lost its authorization five times. The audit trail showed 3–4 rotations in ~6 s, then the previous token re-presented ~29 s later; zero-grace reuse detection revoked everything. See "Delegated session" for what started the storm.

## Delegated session
- Minted at approval (admin magic link → `verifyOtp`; no email is sent) and stored encrypted (`CALENDAR_TOKEN_ENCRYPTION_KEY`) on `agent_authorizations.delegated_*`. Refreshed when the access JWT has < 90 s left.
- **Self-healing order** (`getDelegatedAccessToken`): stored token still fresh → re-read the row (a parallel request may have refreshed it) → Supabase refresh → **re-mint** a new delegated session for the same user (the authorization is still active and was granted by that user) → only then fail. A re-mint is audited as `delegated_session` / result `success` / `{via:"reminted"}`.
- **Failure codes.** No delegated session on the row (revoked / never minted) → `401 session_unavailable` with an `invalid_token` challenge: the agent must re-authorize. Refresh *and* re-mint failed → `503 session_unavailable` + `Retry-After: 5`, **no** `invalid_token` challenge. The 401 used to be returned for both cases; an `invalid_token` challenge is the standard signal for "rotate your OAuth token", which turned a Supabase hiccup into a refresh storm and then into a reuse revocation.

## Reading the audit log for a connector problem
```sql
select created_at, action, result, detail from agent_audit_log
 where client_id = '<client id>' order by created_at desc limit 50;
```
| What you see | Meaning | Do |
|---|---|---|
| `token_refreshed` bursts + `delegated_session` errors interleaved | the client is re-refreshing because requests failed | check Supabase status; the 503 path now stops the storm |
| `token_refreshed_grace_replay` | a retry inside the 120 s window; harmless | nothing (if constant, the client retries too eagerly — tell its owner) |
| `refresh_token_reuse` → authorization revoked | an old refresh token used > 120 s after rotation | agent re-authorizes; if it recurs with no 503s in between, treat as a leaked token |
| `delegated_session` result `success` `{via:"reminted"}` | Supabase refused a refresh; a fresh session was minted | nothing; investigate if it happens every hour |
| `delegated_session` error "refresh and re-mint both failed" | Supabase auth admin unreachable or user deleted | check Supabase auth; the agent gets 503 and should retry |

## Operate
- Revoke an agent: Settings → Connected Agents → Revoke (signs the delegated session out, revokes every token).
- Grant a write scope (e.g. `sfb:outbound:run`): add it to `GRANTABLE_SCOPES` in `lib/agent/scopes.ts`, deploy, agent re-authorizes and ticks the box. Roman's decision, never the agent's.
- Rotating `CALENDAR_TOKEN_ENCRYPTION_KEY` invalidates every stored delegated session: agents re-authorize (the self-healing re-mint also covers this for active authorizations on their next request).
- Tests: `tests/lib/agent.test.ts` (grace-window classification, delegated token state, scope policy, MCP envelope).
