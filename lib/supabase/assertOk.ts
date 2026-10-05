/**
 * Write-error guard (Research Spec §26). Every critical database write in
 * the research pipeline goes through this so a rejected write can never
 * again be silently swallowed -- the exact failure mode that left 71
 * research jobs "running" forever when `status: "complete"` violated the
 * check constraint and nobody looked at the error.
 *
 * Usage:  assertOk(await service.from("x").update({...}).eq(...), "finalize research job", { jobId });
 * Throws a WriteError (with context) instead of returning; callers decide
 * whether that aborts the request or is caught and reported.
 */
export class WriteError extends Error {
  constructor(public readonly operation: string, public readonly code: string | null, public readonly context: Record<string, unknown>) {
    super(`${operation} failed${code ? ` (${code})` : ""}`);
    this.name = "WriteError";
  }
}

type PgResult = { error: { message: string; code?: string | null; details?: string | null } | null };

export function assertOk<T extends PgResult>(result: T, operation: string, context: Record<string, unknown> = {}): T {
  if (result.error) {
    console.error(`[write-failed] ${operation}`, { code: result.error.code ?? null, message: result.error.message, details: result.error.details ?? null, ...context });
    throw new WriteError(operation, result.error.code ?? null, context);
  }
  return result;
}
