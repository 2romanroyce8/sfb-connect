import { emitWebhook } from "./webhooks";
import { emitZapier } from "./zapier";

/**
 * One call site for "something happened that the outside world may care
 * about". Fans out to signed webhooks and Zapier REST hooks. Fire-and-forget:
 * never awaited on the hot path, never throws.
 */
export function emitIntegrationEvent(event: string, payload: Record<string, unknown>) {
  void Promise.allSettled([emitWebhook(event, payload), emitZapier(event, payload)]).catch(() => undefined);
}
