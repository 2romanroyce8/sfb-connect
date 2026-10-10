/**
 * OAuth provider definitions. Each needs a developer app registered with the
 * vendor; its client id/secret live ONLY in Vercel env (names below). A
 * provider is "configured" when both are present. Redirect URI for every
 * provider is `${appOrigin()}/api/team/integrations/<key>/callback` — register
 * exactly that URL in the vendor's app settings.
 */
export type EnvLike = Record<string, string | undefined>;
export type OAuthProviderKey = "gohighlevel" | "gmail" | "meta" | "slack" | "notion" | "linkedin";

export type OAuthProvider = {
  key: OAuthProviderKey;
  name: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  scopeSeparator?: string;
  env: { clientId: string; clientSecret: string };
  /** Extra query params on the authorize URL. */
  authParams?: Record<string, string>;
  /** How client credentials are sent to the token endpoint. */
  tokenAuth: "body" | "basic";
  /** Meta's token endpoint is GET with query params. */
  tokenMethod?: "POST" | "GET";
  /** Extra fields for the token request body. */
  tokenParams?: Record<string, string>;
  /** Pull a human label (email / workspace / location) after exchange. */
  accountLabel: (token: Record<string, unknown>) => Promise<string | null>;
  /** Vendor console where the app is created (for the runbook / team page). */
  consoleUrl: string;
};

export const appOrigin = () => (process.env.NEXT_PUBLIC_APP_URL || "https://www.sfbconnect.com").replace(/\/$/, "");
export const redirectUriFor = (key: string) => `${appOrigin()}/api/team/integrations/${key}/callback`;

const bearerJson = async (url: string, token: string, headers: Record<string, string> = {}) => {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, ...headers } });
  return r.ok ? ((await r.json()) as Record<string, unknown>) : null;
};

export const OAUTH_PROVIDERS: Record<OAuthProviderKey, OAuthProvider> = {
  gohighlevel: {
    key: "gohighlevel", name: "GoHighLevel",
    authorizeUrl: "https://marketplace.gohighlevel.com/oauth/chooselocation",
    tokenUrl: "https://services.leadconnectorhq.com/oauth/token",
    scopes: ["contacts.readonly", "contacts.write", "opportunities.readonly", "opportunities.write", "calendars.readonly", "locations.readonly"],
    scopeSeparator: " ",
    env: { clientId: "GHL_CLIENT_ID", clientSecret: "GHL_CLIENT_SECRET" },
    tokenAuth: "body", tokenParams: { user_type: "Location" },
    accountLabel: async (t) => (typeof t.locationId === "string" ? `Location ${t.locationId}` : null),
    consoleUrl: "https://marketplace.gohighlevel.com/",
  },
  gmail: {
    key: "gmail", name: "Gmail",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.modify", "https://www.googleapis.com/auth/userinfo.email"],
    env: { clientId: "GOOGLE_CLIENT_ID", clientSecret: "GOOGLE_CLIENT_SECRET" },
    authParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
    tokenAuth: "body",
    accountLabel: async (t) => { const u = await bearerJson("https://www.googleapis.com/oauth2/v2/userinfo", String(t.access_token)); return (u?.email as string) ?? null; },
    consoleUrl: "https://console.cloud.google.com/apis/credentials",
  },
  meta: {
    key: "meta", name: "Meta",
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scopes: ["ads_management", "ads_read", "business_management", "pages_show_list", "pages_read_engagement"],
    scopeSeparator: ",",
    env: { clientId: "META_APP_ID", clientSecret: "META_APP_SECRET" },
    tokenAuth: "body", tokenMethod: "GET",
    accountLabel: async (t) => { const u = await bearerJson("https://graph.facebook.com/v21.0/me?fields=name", String(t.access_token)); return (u?.name as string) ?? null; },
    consoleUrl: "https://developers.facebook.com/apps/",
  },
  slack: {
    key: "slack", name: "Slack",
    authorizeUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    scopes: ["chat:write", "channels:read", "channels:join", "incoming-webhook"],
    scopeSeparator: ",",
    env: { clientId: "SLACK_CLIENT_ID", clientSecret: "SLACK_CLIENT_SECRET" },
    tokenAuth: "body",
    accountLabel: async (t) => { const team = t.team as { name?: string } | undefined; return team?.name ?? null; },
    consoleUrl: "https://api.slack.com/apps",
  },
  notion: {
    key: "notion", name: "Notion",
    authorizeUrl: "https://api.notion.com/v1/oauth/authorize",
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    scopes: [],
    env: { clientId: "NOTION_CLIENT_ID", clientSecret: "NOTION_CLIENT_SECRET" },
    authParams: { owner: "user" },
    tokenAuth: "basic",
    accountLabel: async (t) => (typeof t.workspace_name === "string" ? t.workspace_name : null),
    consoleUrl: "https://www.notion.so/profile/integrations",
  },
  linkedin: {
    key: "linkedin", name: "LinkedIn",
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["openid", "profile", "email", "w_member_social"],
    env: { clientId: "LINKEDIN_CLIENT_ID", clientSecret: "LINKEDIN_CLIENT_SECRET" },
    tokenAuth: "body",
    accountLabel: async (t) => { const u = await bearerJson("https://api.linkedin.com/v2/userinfo", String(t.access_token)); return (u?.email as string) ?? (u?.name as string) ?? null; },
    consoleUrl: "https://www.linkedin.com/developers/apps",
  },
};

export const isOAuthProviderKey = (k: string): k is OAuthProviderKey => k in OAUTH_PROVIDERS;
export const oauthConfigured = (p: OAuthProvider, env: EnvLike = process.env) => !!env[p.env.clientId] && !!env[p.env.clientSecret];

export function buildAuthorizeUrl(p: OAuthProvider, state: string, env: EnvLike = process.env): string {
  const u = new URL(p.authorizeUrl);
  u.searchParams.set("client_id", env[p.env.clientId]!);
  u.searchParams.set("redirect_uri", redirectUriFor(p.key));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("state", state);
  if (p.scopes.length) u.searchParams.set("scope", p.scopes.join(p.scopeSeparator ?? " "));
  for (const [k, v] of Object.entries(p.authParams ?? {})) u.searchParams.set(k, v);
  return u.toString();
}

export type TokenResult = { access_token: string; refresh_token?: string; expires_in?: number; scope?: string; raw: Record<string, unknown> };

export async function exchangeCode(p: OAuthProvider, code: string, env: EnvLike = process.env, f: typeof fetch = fetch): Promise<TokenResult> {
  const clientId = env[p.env.clientId]!, clientSecret = env[p.env.clientSecret]!;
  const params: Record<string, string> = { grant_type: "authorization_code", code, redirect_uri: redirectUriFor(p.key), ...(p.tokenParams ?? {}) };
  const headers: Record<string, string> = { Accept: "application/json" };
  if (p.tokenAuth === "basic") headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  else { params.client_id = clientId; params.client_secret = clientSecret; }
  let res: Response;
  if (p.tokenMethod === "GET") {
    const u = new URL(p.tokenUrl); for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    res = await f(u.toString(), { headers });
  } else if (p.tokenAuth === "basic") {
    res = await f(p.tokenUrl, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(params) });
  } else {
    res = await f(p.tokenUrl, { method: "POST", headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
  }
  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  // Slack nests the bot token; everyone else is flat.
  const access = (raw.access_token as string) ?? ((raw as { authed_user?: { access_token?: string } }).authed_user?.access_token);
  if (!res.ok || !access || raw.ok === false) throw new Error((raw.error_description as string) || (raw.error as string) || (raw.message as string) || `${p.name} token exchange failed (${res.status}).`);
  return { access_token: access, refresh_token: raw.refresh_token as string | undefined, expires_in: typeof raw.expires_in === "number" ? raw.expires_in : undefined, scope: raw.scope as string | undefined, raw };
}

export async function refreshToken(p: OAuthProvider, refresh: string, env: EnvLike = process.env, f: typeof fetch = fetch): Promise<TokenResult> {
  const clientId = env[p.env.clientId]!, clientSecret = env[p.env.clientSecret]!;
  const params: Record<string, string> = { grant_type: "refresh_token", refresh_token: refresh, ...(p.tokenParams ?? {}) };
  const headers: Record<string, string> = { Accept: "application/json" };
  if (p.tokenAuth === "basic") headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  else { params.client_id = clientId; params.client_secret = clientSecret; }
  const res = await f(p.tokenUrl, { method: "POST", headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !raw.access_token) throw new Error((raw.error_description as string) || (raw.error as string) || `${p.name} token refresh failed (${res.status}).`);
  return { access_token: raw.access_token as string, refresh_token: (raw.refresh_token as string) ?? refresh, expires_in: typeof raw.expires_in === "number" ? raw.expires_in : undefined, scope: raw.scope as string | undefined, raw };
}
