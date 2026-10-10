import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { encryptToken, decryptToken } from "@/lib/crm/tokenCrypto";
import { OAUTH_PROVIDERS, isOAuthProviderKey, refreshToken, type TokenResult } from "./providers";

/**
 * Encrypted connection store shared by every provider. Secrets never leave the
 * server; callers get a usable access token (refreshed if needed) or a
 * NotConnectedError. Public reads go through `listConnectionSummaries`, which
 * never selects a token column.
 */
export class NotConnectedError extends Error { constructor(provider: string) { super(`${provider} is not connected for this user.`); } }

export type ConnectionSummary = { provider: string; owner_id: string; account_label: string | null; connected_at: string; status: "active" | "error"; last_error: string | null; metadata: Record<string, unknown> };

export async function saveConnection(provider: string, ownerId: string, token: { access_token: string; refresh_token?: string | null; expires_in?: number; scope?: string }, accountLabel: string | null, metadata: Record<string, unknown> = {}) {
  const service = createSupabaseServiceClient();
  const row = {
    provider, owner_id: ownerId, account_label: accountLabel,
    access_token_enc: encryptToken(token.access_token),
    refresh_token_enc: token.refresh_token ? encryptToken(token.refresh_token) : null,
    token_expires_at: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
    scope: token.scope ?? null, metadata, status: "active", last_error: null, updated_at: new Date().toISOString(),
  };
  const { error } = await service.from("integration_connections").upsert(row, { onConflict: "provider,owner_id" });
  if (error) throw new Error(`Could not save ${provider} connection: ${error.message}`);
  await markProviderVerified(provider);
}

/** First successful connection of a provider = the connect flow is proven = registry may say "live". */
export async function markProviderVerified(provider: string) {
  const service = createSupabaseServiceClient();
  const { data } = await service.from("integration_provider_verifications").select("connections").eq("provider", provider).maybeSingle();
  if (data) await service.from("integration_provider_verifications").update({ last_connected_at: new Date().toISOString(), connections: (data.connections as number) + 1 }).eq("provider", provider);
  else await service.from("integration_provider_verifications").insert({ provider });
}

export async function deleteConnection(provider: string, ownerId: string) {
  const service = createSupabaseServiceClient();
  await service.from("integration_connections").delete().eq("provider", provider).eq("owner_id", ownerId);
}

export async function listConnectionSummaries(ownerId?: string): Promise<ConnectionSummary[]> {
  const service = createSupabaseServiceClient();
  let q = service.from("integration_connections").select("provider, owner_id, account_label, connected_at, status, last_error, metadata");
  if (ownerId) q = q.eq("owner_id", ownerId);
  const { data } = await q;
  return (data ?? []) as ConnectionSummary[];
}

export async function verifiedProviders(): Promise<Set<string>> {
  const service = createSupabaseServiceClient();
  const { data } = await service.from("integration_provider_verifications").select("provider");
  return new Set(((data ?? []) as { provider: string }[]).map((r) => r.provider));
}

/** Decrypted access token for an OAuth provider, refreshed when within 60s of expiry. */
export async function getAccessToken(provider: string, ownerId: string): Promise<{ token: string; metadata: Record<string, unknown> }> {
  const service = createSupabaseServiceClient();
  const { data } = await service.from("integration_connections").select("access_token_enc, refresh_token_enc, token_expires_at, metadata").eq("provider", provider).eq("owner_id", ownerId).maybeSingle();
  if (!data?.access_token_enc) throw new NotConnectedError(provider);
  const expires = data.token_expires_at ? new Date(data.token_expires_at).getTime() : null;
  if (expires && expires - Date.now() < 60_000 && data.refresh_token_enc && isOAuthProviderKey(provider)) {
    try {
      const t: TokenResult = await refreshToken(OAUTH_PROVIDERS[provider], decryptToken(data.refresh_token_enc));
      await service.from("integration_connections").update({ access_token_enc: encryptToken(t.access_token), refresh_token_enc: t.refresh_token ? encryptToken(t.refresh_token) : data.refresh_token_enc, token_expires_at: t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null, status: "active", last_error: null, updated_at: new Date().toISOString() }).eq("provider", provider).eq("owner_id", ownerId);
      return { token: t.access_token, metadata: (data.metadata ?? {}) as Record<string, unknown> };
    } catch (e) {
      await service.from("integration_connections").update({ status: "error", last_error: e instanceof Error ? e.message.slice(0, 300) : "refresh failed", updated_at: new Date().toISOString() }).eq("provider", provider).eq("owner_id", ownerId);
      throw e;
    }
  }
  return { token: decryptToken(data.access_token_enc), metadata: (data.metadata ?? {}) as Record<string, unknown> };
}

/** For non-OAuth providers that store a secret (Apple app-specific password). */
export async function getStoredSecret(provider: string, ownerId: string): Promise<{ secret: string; metadata: Record<string, unknown> }> {
  const { token, metadata } = await getAccessToken(provider, ownerId);
  return { secret: token, metadata };
}
