import AgentCallbackClient from "./AgentCallbackClient";
export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Hosted completion page for loopback OAuth callbacks (see approve route). */
export default function AgentCallbackPage({ searchParams }: { searchParams: Search }) {
  const raw = one(searchParams.u);
  const agent = one(searchParams.agent) || "the agent";
  let url: URL | null = null;
  try { url = new URL(raw); } catch { url = null; }
  const loopback = !!url && ["127.0.0.1", "localhost", "[::1]", "::1"].includes(url.hostname);
  if (!url || !loopback) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "#050505", color: "#F5F5F7" }}>
        <div className="w-full max-w-[460px] rounded-[14px] p-6 text-[13px]" style={{ background: "#0D0D0D", border: "1px solid rgba(255,255,255,0.08)" }}>This page only completes agent connections that use a local callback address.</div>
      </main>
    );
  }
  const code = url.searchParams.get("code") ?? "";
  const error = url.searchParams.get("error") ?? "";
  const errorDescription = url.searchParams.get("error_description") ?? "";
  return <AgentCallbackClient agent={agent} callbackUrl={url.toString()} code={code} error={error} errorDescription={errorDescription} />;
}
