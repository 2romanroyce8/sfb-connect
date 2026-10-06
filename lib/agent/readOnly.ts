/** Agent browser sessions are read-only: anything that is not a safe HTTP
 * method is refused by the middleware before it reaches a route handler. */
export const AGENT_SESSION_COOKIE = "sfb_agent";
export function isMutatingMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}
