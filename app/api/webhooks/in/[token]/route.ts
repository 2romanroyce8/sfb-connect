import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { lookupInboundToken } from "@/lib/integrations/webhooks";
import { createTask } from "@/lib/agent/tasks/queue";
import { markProviderVerified } from "@/lib/integrations/connections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Inbound webhook receiver. Unknown token → 404 with no body detail. Each
 * event is stored (payload capped at 64 KB) and, if the token says so, filed
 * as a task for Atlas to act on with HyperAgent review. Always 202 on success
 * so senders don't retry.
 */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  if (!/^sfbin_[A-Za-z0-9_-]{20,}$/.test(params.token)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const t = await lookupInboundToken(params.token);
  if (!t) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const raw = (await req.text()).slice(0, 65_536);
  let payload: unknown = null; try { payload = raw ? JSON.parse(raw) : null; } catch { payload = null; }
  const headers: Record<string, string> = {};
  for (const k of ["content-type", "user-agent", "x-event", "x-github-event", "x-hub-signature-256", "stripe-signature"]) { const v = req.headers.get(k); if (v) headers[k] = v.slice(0, 200); }
  const s = createSupabaseServiceClient();
  const { data: ev } = await s.from("inbound_webhook_events").insert({ token_id: t.id, source_ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null, headers, payload, raw_body: payload ? null : raw }).select("id").single();
  let taskId: string | null = null;
  if (t.file_task) {
    try {
      const task = await createTask("hyperagent", {
        title: `Inbound webhook: ${t.label}`.slice(0, 200),
        owner_agent: "atlas", reviewer_agent: "hyperagent", requires_review: true, priority: "normal",
        context: `An external system posted to the "${t.label}" inbound webhook.\n\nHeaders: ${JSON.stringify(headers)}\n\nPayload:\n${(payload ? JSON.stringify(payload, null, 2) : raw).slice(0, 12000)}\n\nDecide whether it needs action (e.g. a new lead, a form submission, a status change) and post the result. Do not contact anyone from this task without approval.`,
      });
      taskId = task.id;
      if (ev) await s.from("inbound_webhook_events").update({ task_id: task.id }).eq("id", ev.id);
    } catch { /* event is stored regardless */ }
  }
  const { data: cur } = await s.from("inbound_webhook_tokens").select("received_count").eq("id", t.id).single();
  await s.from("inbound_webhook_tokens").update({ received_count: ((cur?.received_count as number) ?? 0) + 1, last_received_at: new Date().toISOString() }).eq("id", t.id);
  await markProviderVerified("webhooks");
  return NextResponse.json({ received: true, event_id: ev?.id ?? null, task_id: taskId }, { status: 202 });
}

export async function GET() { return NextResponse.json({ error: "method_not_allowed" }, { status: 405 }); }
