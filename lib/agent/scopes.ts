// ============================================================
// AGENT SCOPES
// Read scopes are grantable today. Write scopes exist so the architecture
// is ready for them, but they are NOT grantable in Phase 1: a client that
// requests one gets the read scopes it asked for and a note that write
// access is not yet available. Starting research is its own scope because
// it costs real money; reading research never does.
// ============================================================
export const READ_SCOPES = {
  "sfb:workspace:read": "See which workspace and role you are connected as",
  "sfb:team:read": "View the team roster",
  "sfb:leads:read": "View and search leads",
  "sfb:pipeline:read": "View the sales pipeline",
  "sfb:research:read": "View research results, sources and research status",
  "sfb:audit:read": "View Business Readiness Audits",
  "sfb:ai_presence:read": "View AI Presence data",
  "sfb:browser": "Open the SFB Connect dashboard as you (read-only delegated web session)",
} as const;

export const WRITE_SCOPES = {
  "sfb:leads:write": "Create and update leads",
  "sfb:pipeline:write": "Move pipeline stages",
  "sfb:research:start": "Start new research (costs search budget)",
  "sfb:audit:run": "Generate Business Readiness Audits",
  "sfb:ai_presence:run": "Run AI Presence scans (costs provider budget)",
  "sfb:followups:write": "Create and update follow-ups",
} as const;

export type ReadScope = keyof typeof READ_SCOPES;
export type WriteScope = keyof typeof WRITE_SCOPES;
export type Scope = ReadScope | WriteScope;

export const ALL_SCOPES: Scope[] = [...(Object.keys(READ_SCOPES) as ReadScope[]), ...(Object.keys(WRITE_SCOPES) as WriteScope[])];
export const GRANTABLE_SCOPES: Scope[] = Object.keys(READ_SCOPES) as ReadScope[];
export const DEFAULT_SCOPES: Scope[] = ["sfb:workspace:read", "sfb:team:read", "sfb:leads:read", "sfb:pipeline:read", "sfb:research:read", "sfb:audit:read", "sfb:ai_presence:read", "sfb:browser"];

export function describeScope(scope: string): string {
  return (READ_SCOPES as Record<string, string>)[scope] ?? (WRITE_SCOPES as Record<string, string>)[scope] ?? scope;
}
export function isWriteScope(scope: string): boolean {
  return scope in WRITE_SCOPES;
}
/** Normalizes a requested scope string: unknown scopes dropped, write scopes
 * dropped (Phase 1), empty -> defaults. Returns what was granted and what
 * was refused so the consent screen can say so. */
export function negotiateScopes(requested: string | string[] | null | undefined): { granted: Scope[]; refused: string[] } {
  const list = (Array.isArray(requested) ? requested : (requested ?? "").split(/[\s,]+/)).map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return { granted: [...DEFAULT_SCOPES], refused: [] };
  const granted: Scope[] = [];
  const refused: string[] = [];
  for (const s of list) {
    if ((GRANTABLE_SCOPES as string[]).includes(s)) { if (!granted.includes(s as Scope)) granted.push(s as Scope); }
    else refused.push(s);
  }
  // A connection that asked only for things we can't grant still gets a
  // usable read-only session rather than nothing.
  if (granted.length === 0) granted.push(...DEFAULT_SCOPES);
  if (!granted.includes("sfb:workspace:read")) granted.unshift("sfb:workspace:read");
  return { granted, refused };
}
