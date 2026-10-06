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
// ============================================================

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function mintDelegatedSession(userId: string): Promise<{ refreshEnc: string; accessEnc: string; expiresAt: string }> {
  const service = createSupabaseServiceClient();
  const { data: userRow, error: uErr } = await service.auth.admin.getUserById(userId);
  if (uErr || !userRow.user?.email) throw new Error("Could not load the authorizing user.");
  const { data: link, error: lErr } = await service.auth.admin.generateLink({ type: "magiclink", email: userRow.user.email });
  if (lErr || !link.properties?.hashed_token) throw new Error(`Could not mint a delegated session: ${lErr?.message ?? "no token"}`);
  const fresh = createClient(url(), anon(), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: verified, error: vErr } = await fresh.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
  if (vErr || !verified.session) throw new Error(`Could not establish a delegated session: ${vErr?.message ?? "no session"}`);
  const s = verified.session;
  return { refreshEnc: encryptToken(s.refresh_token), accessEnc: encryptToken(s.access_token), expiresAt: new Date((s.expires_at ?? Math.floor(Date.now() / 1000) + 3600) * 1000).toISOString() };
}

/** Returns a valid delegated access JWT, refreshing (and persisting the rotated refresh token) when near expiry. */
export async function getDelegatedAccessToken(auth: AgentAuthorization): Promise<{ accessToken: string; refreshToken: string } | null> {
  if (!auth.delegated_refresh_enc) return null;
  const expiresAt = auth.delegated_access_expires_at ? new Date(auth.delegated_access_expires_at).getTime() : 0;
  if (auth.delegated_access_enc && expiresAt - Date.now() > 90_000) {
    return { accessToken: decryptToken(auth.delegated_access_enc), refreshToken: decryptToken(auth.delegated_refresh_enc) };
  }
  const fresh = createClient(url(), anon(), { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await fresh.auth.refreshSession({ refresh_token: decryptToken(auth.delegated_refresh_enc) });
  if (error || !data.session) return null;
  const s = data.session;
  await svc().from("agent_authorizations").update({
    delegated_refresh_enc: encryptToken(s.refresh_token), delegated_access_enc: encryptToken(s.access_token),
    delegated_access_expires_at: new Date((s.expires_at ?? Math.floor(Date.now() / 1000) + 3600) * 1000).toISOString(),
  }).eq("id", auth.id);
  return { accessToken: s.access_token, refreshToken: s.refresh_token };
}

/** A Supabase client that acts AS the authorizing user: RLS decides what it sees. */
export async function delegatedUserClient(auth: AgentAuthorization): Promise<SupabaseClient | null> {
  const tok = await getDelegatedAccessToken(auth);
  if (!tok) return null;
  return createClient(url(), anon(), { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${tok.accessToken}` } } });
}

/** Signs the delegated Supabase session out (server-side), leaving the user's own sessions intact. */
export async function signOutDelegatedSession(auth: AgentAuthorization) {
  try {
    const tok = await getDelegatedAccessToken(auth);
    if (tok) await createSupabaseServiceClient().auth.admin.signOut(tok.accessToken, "local");
  } catch (e) { console.error("[agent] delegated sign-out failed", e); }
  await svc().from("agent_authorizations").update({ delegated_refresh_enc: null, delegated_access_enc: null, delegated_access_expires_at: null }).eq("id", auth.id);
}
