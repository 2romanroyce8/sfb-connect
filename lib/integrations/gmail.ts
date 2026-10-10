import { getAccessToken } from "./connections";

/**
 * Gmail through the connected owner's mailbox (OAuth scopes gmail.send +
 * gmail.modify). Transactional product mail stays on Resend; this is for
 * outreach the owner approves. Nothing here sends on its own: callers are the
 * owner-only team API and, later, the approval-gated agent path.
 */
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

async function gfetch(ownerId: string, path: string, init: RequestInit = {}) {
  const { token } = await getAccessToken("gmail", ownerId);
  const r = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new Error(((j.error as { message?: string })?.message) || `Gmail API ${r.status}`);
  return j;
}

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function sendGmail(ownerId: string, msg: { to: string; subject: string; text: string; html?: string; replyTo?: string; threadId?: string; inReplyTo?: string }) {
  const boundary = `sfb_${Date.now()}`;
  const headers = [`To: ${msg.to}`, `Subject: ${msg.subject}`, msg.replyTo ? `Reply-To: ${msg.replyTo}` : null, msg.inReplyTo ? `In-Reply-To: ${msg.inReplyTo}` : null, msg.inReplyTo ? `References: ${msg.inReplyTo}` : null, "MIME-Version: 1.0"].filter(Boolean);
  const body = msg.html
    ? [`Content-Type: multipart/alternative; boundary="${boundary}"`, "", `--${boundary}`, "Content-Type: text/plain; charset=UTF-8", "", msg.text, `--${boundary}`, "Content-Type: text/html; charset=UTF-8", "", msg.html, `--${boundary}--`].join("\r\n")
    : ["Content-Type: text/plain; charset=UTF-8", "", msg.text].join("\r\n");
  const raw = b64url(`${headers.join("\r\n")}\r\n${body}`);
  return gfetch(ownerId, "/messages/send", { method: "POST", body: JSON.stringify({ raw, threadId: msg.threadId }) }) as Promise<{ id: string; threadId: string }>;
}

export type GmailMessage = { id: string; threadId: string; from: string; to: string; subject: string; date: string; snippet: string; unread: boolean };

export async function listGmailMessages(ownerId: string, opts: { q?: string; max?: number } = {}): Promise<GmailMessage[]> {
  const list = (await gfetch(ownerId, `/messages?maxResults=${Math.min(opts.max ?? 20, 50)}${opts.q ? `&q=${encodeURIComponent(opts.q)}` : ""}`)) as { messages?: { id: string }[] };
  const ids = list.messages ?? [];
  const out: GmailMessage[] = [];
  for (const { id } of ids) {
    const m = (await gfetch(ownerId, `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`)) as { id: string; threadId: string; snippet: string; labelIds?: string[]; payload?: { headers?: { name: string; value: string }[] } };
    const h = (n: string) => m.payload?.headers?.find((x) => x.name.toLowerCase() === n)?.value ?? "";
    out.push({ id: m.id, threadId: m.threadId, from: h("from"), to: h("to"), subject: h("subject"), date: h("date"), snippet: m.snippet, unread: !!m.labelIds?.includes("UNREAD") });
  }
  return out;
}

export async function getGmailMessage(ownerId: string, id: string): Promise<{ headers: Record<string, string>; text: string; html: string | null; threadId: string }> {
  const m = (await gfetch(ownerId, `/messages/${id}?format=full`)) as { threadId: string; payload: Part };
  const headers: Record<string, string> = {};
  for (const h of m.payload.headers ?? []) headers[h.name.toLowerCase()] = h.value;
  const parts: Part[] = []; const walk = (p: Part) => { parts.push(p); (p.parts ?? []).forEach(walk); }; walk(m.payload);
  const decode = (p?: Part) => (p?.body?.data ? Buffer.from(p.body.data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8") : "");
  return { headers, text: decode(parts.find((p) => p.mimeType === "text/plain")), html: decode(parts.find((p) => p.mimeType === "text/html")) || null, threadId: m.threadId };
}
type Part = { mimeType?: string; headers?: { name: string; value: string }[]; body?: { data?: string }; parts?: Part[] };
