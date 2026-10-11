import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { encryptToken, decryptToken } from "@/lib/crm/tokenCrypto";
import { svc, type AgentAuthorization } from "./store";

// ============================================================
// DELEGATED SESSION
//
// The agent never gets the user's password or cookies. When the user
// authorizes an agent, SFB Connect mints a SEPARATE Supabase session for
// that user (admin magic link -> verifyOtp, no email is sent) and stores
// its refresh token encrypted at rest. Every agent data request then runs
// through a Supabase client carrying that user's JWT, so Row Level
// Security, team role and lead assignment apply exactly as they do when
// the user is logged in themselves. Revoking the authorization signs that
// session out server-side; the user's own browser session is untouched.
//
// Self-healing (2026-10-11, Muse refresh bug): a delegated session can stop
// refreshing for reasons that have nothing to do with the agent's OAuth
// grant — two parallel requests rotating the same Supabase refresh token,
// a session signed out, Supabase hiccups. The authorization is still
// active and was granted by this exact user, so instead of failing the
// request we re-read the row (a parallel request may already hold a fresh
// token), refresh, and as a last resort mint a new delegated session the
// same way approval did. Only a revoked authorization yields null.
// ============================================================

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Refresh when the stored access JWT has less than this much life left. */
export const DELEGATED_REFRESH_SKEW_MS = 90_000;

type DelegatedRow = { delegated_refresh_enc: string | null; delegated_access_enc: string | null; delegated_access_expires_at: string | null };
export type DelegatedState = "fresh" | "refresh" | "missing";

/** Pure: what to do with the delegated tokens stored on an authorization row. */
export function delegatedTokenState(row: DelegatedRow, now: number = Date.now()): DelegatedState {
  if (!row.delegated_refresh_enc) return "missing";
  const exp = row.delegated_access_expires_at ? Date.parse(row.delegated_access_expires_at) : 0;
  return row.delegated_access_enc && Number.isFinite(exp) && exp - now > DELEGATED_REFRESH_SKEW_MS ? "fresh" : "refresh";
}

export type MintedSession = { refreshEnc: string; accessEnc: string; expiresAt: string; refreshToken: string; accessToken: string };

export async function mintDelegatedSession(userId: string): Promise<MintedSession> {
  const service = createSupabaseServiceClient();
  const { data: userRow, error: uErr } = await service.auth.admin.getUserById(userId);
  if (uErr || !userRow.user?.email) throw new Error("Could not load the authorizing user.");
  const { data: link, error: lErr } = await service.auth.admin.generateLink({ type: "magiclink", email: userRow.user.email });
  if (lErr || !link.properties?.hashed_token) throw new Error(`Could not mint a delegated session: ${lErr?.message ?? "no token"}`);
  const fresh = createClient(url(), anon(), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: verified, error: vErr } = await fresh.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (vErr || !verified.session) throw new Error(`Could not establish a delegated session: ${vErr?.message ?? "no session"}`);
  const s = verified.session;
  return { refreshEnc: encryptToken(s.refresh_token), accessEnc: encryptToken(s.access_token), expiresAt: expiresIso(s.expires_at), refreshToken: s.refresh_token, accessToken: s.access_token };
}

const expiresIso = (expiresAt: number | undefined) => new Date((expiresAt ?? Math.floor(Date.now() / 1000) + 3600) * 1000).toISOString();

/** How the token was obtained — surfaced to the audit log so recoveries are visible. */
export type DelegatedVia = "stored" | "concurrent" | "refreshed" | "reminted";
export type DelegatedToken = { accessToken: string; refreshToken: string; via: DelegatedVia };

async function persistDelegated(authorizationId: string, s: { refreshToken: string; accessToken: string; expiresAt: string }): Promise<boolean> {
  // Only an active authorization keeps tokens; a revoke that landed meanwhile wins.
  const { data } = await svc().from("agent_authorizations").update({
    delegated_refresh_enc: encryptToken(s.refreshToken), delegated_access_enc: encryptToken(s.accessToken), delegated_access_expires_at: s.expiresAt,
  }).eq("id", authorizationId).eq("status", "active").select("id");
  return (data?.length ?? 0) > 0;
}

/** Returns a valid delegated access JWT, refreshing (and persisting the rotated refresh token) when near expiry; re-mints when Supabase refuses the refresh. Null only when the authorization has no delegated session (revoked / never minted). */
export async function getDelegatedAccessToken(auth: AgentAuthorization): Promise<DelegatedToken | null> {
  const first = delegatedTokenState(auth);
  if (first === "missing") return null;
  if (first === "fresh") return { accessToken: decryptToken(auth.delegated_access_enc!), refreshToken: decryptToken(auth.delegated_refresh_enc!), via: "stored" };

  // Re-read: a parallel request may have refreshed seconds ago. Using its
  // tokens avoids presenting an already-rotated Supabase refresh token.
  const { data: current } = await svc().from("agent_authorizations").select("status, delegated_refresh_enc, delegated_access_enc, delegated_access_expires_at").eq("id", auth.id).maybeSingle();
  if (!current || current.status !== "active") return null;
  const state = delegatedTokenState(current);
  if (state === "missing") return null;
  if (state === "fresh") return { accessToken: decryptToken(current.delegated_access_enc!), refreshToken: decryptToken(current.delegated_refresh_enc!), via: "concurrent" };

  const fresh = createClient(url(), anon(), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await fresh.auth.refreshSession({ refresh_token: decryptToken(current.delegated_refresh_enc!) });
  if (!error && data.session) {
    const s = data.session;
    const kept = await persistDelegated(auth.id, { refreshToken: s.refresh_token, accessToken: s.access_token, expiresAt: expiresIso(s.expires_at) });
    return kept ? { accessToken: s.access_token, refreshToken: s.refresh_token, via: "refreshed" } : null;
  }
  console.warn("[agent] delegated refresh refused, re-minting", { authorizationId: auth.id, reason: error?.message ?? "no session" });

  // Supabase refused the refresh. The authorization is still active and was
  // granted by this user, so mint a new delegated session exactly as
  // approval did; the user's own sessions are untouched.
  try {
    const minted = await mintDelegatedSession(auth.user_id);
    const kept = await persistDelegated(auth.id, minted);
    if (!kept) {
      // Revoked while we were minting: don't leave an orphan session behind.
      await createSupabaseServiceClient().auth.admin.signOut(minted.accessToken, "local").catch(() => undefined);
      return null;
    }
    return { accessToken: minted.accessToken, refreshToken: minted.refreshToken, via: "reminted" };
  } catch (e) {
    console.error("[agent] delegated re-mint failed", { authorizationId: auth.id, error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

/** A Supabase client that acts AS the authorizing user (RLS decides what it sees), plus how its token was obtained. */
export async function resolveDelegatedUserClient(auth: AgentAuthorization): Promise<{ client: SupabaseClient; via: DelegatedVia } | null> {
  const tok = await getDelegatedAccessToken(auth);
  if (!tok) return null;
  const client = createClient(url(), anon(), { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${tok.accessToken}` } } });
  return { client, via: tok.via };
}

/** A Supabase client that acts AS the authorizing user: RLS decides what it sees. */
export async function delegatedUserClient(auth: AgentAuthorization): Promise<SupabaseClient | null> {
  return (await resolveDelegatedUserClient(auth))?.client ?? null;
}

/** Signs the delegated Supabase session out (server-side), leaving the user's own sessions intact. */
export async function signOutDelegatedSession(auth: AgentAuthorization) {
  try {
    // Sign out whatever session is stored; never re-mint one just to sign it out.
    if (auth.delegated_access_enc) await createSupabaseServiceClient().auth.admin.signOut(decryptToken(auth.delegated_access_enc), "local");
  } catch (e) { console.error("[agent] delegated sign-out failed", e); }
  await svc().from("agent_authorizations").update({ delegated_refresh_enc: null, delegated_access_enc: null, delegated_access_expires_at: null }).eq("id", auth.id);
}
