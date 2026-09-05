import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { encryptToken, decryptToken } from "./tokenCrypto";

// Every function here talks to Google's real Calendar API. Nothing in this
// file invents a Meet URL, an event ID, or an availability answer — if
// Google's API can't be reached or returns an error, callers get a typed
// error and must surface it honestly instead of pretending success.

export class GoogleNotConnectedError extends Error {
  constructor() {
    super("Google Calendar isn't connected for this rep yet.");
    this.name = "GoogleNotConnectedError";
  }
}
export class GoogleAuthExpiredError extends Error {
  constructor() {
    super("Google Calendar access has expired or was revoked. Reconnect it from Integrations.");
    this.name = "GoogleAuthExpiredError";
  }
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_BASE = "https://www.googleapis.com/calendar/v3";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not configured.`);
  return v;
}

export function getGoogleOAuthConfig() {
  return {
    clientId: requireEnv("GOOGLE_CLIENT_ID"),
    clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
    redirectUri: requireEnv("GOOGLE_OAUTH_REDIRECT_URI"),
  };
}

export function buildGoogleAuthUrl(state: string) {
  const { clientId, redirectUri } = getGoogleOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Google token exchange failed.");
  return data as { access_token: string; refresh_token?: string; expires_in: number; scope: string };
}

async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new GoogleAuthExpiredError();
  return data as { access_token: string; expires_in: number };
}

/** Returns a live access token for this rep, refreshing it if needed. */
async function getValidAccessToken(repId: string): Promise<string> {
  const service = createSupabaseServiceClient();
  const { data: conn } = await service
    .from("crm_calendar_connections")
    .select("access_token_enc, refresh_token_enc, token_expires_at")
    .eq("rep_id", repId)
    .maybeSingle();
  if (!conn) throw new GoogleNotConnectedError();

  const expiresAt = new Date(conn.token_expires_at).getTime();
  if (expiresAt - Date.now() > 60_000) {
    return decryptToken(conn.access_token_enc);
  }

  const refreshToken = decryptToken(conn.refresh_token_enc);
  const refreshed = await refreshAccessToken(refreshToken);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await service
    .from("crm_calendar_connections")
    .update({ access_token_enc: encryptToken(refreshed.access_token), token_expires_at: newExpiresAt, updated_at: new Date().toISOString() })
    .eq("rep_id", repId);
  return refreshed.access_token;
}

async function callCalendarApi(repId: string, path: string, init: RequestInit = {}) {
  const token = await getValidAccessToken(repId);
  const res = await fetch(`${CAL_BASE}${path}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (res.status === 401) throw new GoogleAuthExpiredError();
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error?.message || `Google Calendar API error (${res.status}).`);
  return data;
}

export async function connectGoogleCalendar(repId: string, code: string) {
  const tokens = await exchangeCodeForTokens(code);
  if (!tokens.refresh_token) {
    // Google only issues a refresh_token on first consent (or with
    // prompt=consent, which we always pass) — if it's still missing, the
    // connection can't survive an access-token expiry, so refuse it rather
    // than silently storing a connection that'll break in an hour.
    throw new Error("Google didn't return a refresh token. Try disconnecting any prior SFB Connect access in your Google Account and reconnecting.");
  }

  const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userInfo = await userInfoRes.json();

  const service = createSupabaseServiceClient();
  await service.from("crm_calendar_connections").upsert(
    {
      rep_id: repId,
      google_email: userInfo.email || null,
      access_token_enc: encryptToken(tokens.access_token),
      refresh_token_enc: encryptToken(tokens.refresh_token),
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      calendar_id: "primary",
      scope: tokens.scope,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "rep_id" }
  );
  return { email: userInfo.email as string };
}

export async function disconnectGoogleCalendar(repId: string) {
  const service = createSupabaseServiceClient();
  await service.from("crm_calendar_connections").delete().eq("rep_id", repId);
}

export type BusyBlock = { start: string; end: string };

export async function getBusyBlocks(repId: string, timeMinISO: string, timeMaxISO: string): Promise<BusyBlock[]> {
  const data = await callCalendarApi(repId, "/freeBusy", {
    method: "POST",
    body: JSON.stringify({ timeMin: timeMinISO, timeMax: timeMaxISO, items: [{ id: "primary" }] }),
  });
  return data.calendars?.primary?.busy || [];
}

export async function createCalendarEvent(
  repId: string,
  params: { summary: string; description: string; startISO: string; endISO: string; timeZone: string }
) {
  const data = await callCalendarApi(repId, "/calendars/primary/events?conferenceDataVersion=1", {
    method: "POST",
    body: JSON.stringify({
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.startISO, timeZone: params.timeZone },
      end: { dateTime: params.endISO, timeZone: params.timeZone },
      conferenceData: {
        createRequest: {
          requestId: `sfb-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    }),
  });

  const meetEntry = (data.conferenceData?.entryPoints || []).find((e: any) => e.entryPointType === "video");
  if (!meetEntry?.uri) {
    // Never fabricate a Meet URL — if Google didn't hand one back, the
    // event still exists (so we return it), but the caller must tell the
    // rep the video link didn't generate rather than making one up.
    return { eventId: data.id as string, htmlLink: data.htmlLink as string, meetUrl: null as string | null };
  }
  return { eventId: data.id as string, htmlLink: data.htmlLink as string, meetUrl: meetEntry.uri as string };
}

export async function updateCalendarEvent(repId: string, eventId: string, params: { startISO?: string; endISO?: string; timeZone?: string; summary?: string; description?: string }) {
  const body: Record<string, unknown> = {};
  if (params.summary) body.summary = params.summary;
  if (params.description) body.description = params.description;
  if (params.startISO) body.start = { dateTime: params.startISO, timeZone: params.timeZone };
  if (params.endISO) body.end = { dateTime: params.endISO, timeZone: params.timeZone };
  return callCalendarApi(repId, `/calendars/primary/events/${eventId}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function deleteCalendarEvent(repId: string, eventId: string) {
  try {
    await callCalendarApi(repId, `/calendars/primary/events/${eventId}`, { method: "DELETE" });
  } catch (err) {
    // Google returns 410 Gone for an already-deleted event — treat that as
    // success rather than surfacing an error for something already true.
    if (!(err instanceof Error) || !err.message.includes("410")) throw err;
  }
}

export async function listUpcomingEvents(repId: string, timeMinISO: string, timeMaxISO: string) {
  const params = new URLSearchParams({ timeMin: timeMinISO, timeMax: timeMaxISO, singleEvents: "true", orderBy: "startTime" });
  const data = await callCalendarApi(repId, `/calendars/primary/events?${params.toString()}`);
  return (data.items || []) as any[];
}
