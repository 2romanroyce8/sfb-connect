"use client";

import { useState } from "react";

export default function AgentCallbackClient({ agent, callbackUrl, code, error, errorDescription }: { agent: string; callbackUrl: string; code: string; error: string; errorDescription: string }) {
  const [copied, setCopied] = useState<"url" | "code" | null>(null);
  const copy = async (what: "url" | "code") => {
    try { await navigator.clipboard.writeText(what === "url" ? callbackUrl : code); setCopied(what); setTimeout(() => setCopied(null), 2000); } catch { /* selection fallback below */ }
  };
  const mono: React.CSSProperties = { background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" };
  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "#050505", color: "#F5F5F7" }}>
      <div className="w-full max-w-[520px] rounded-[14px] p-6" style={{ background: "#0D0D0D", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="text-[11px] uppercase tracking-[0.14em] text-[#6E6E73] mb-2">SFB Connect · Agent access</div>
        {error ? (
          <>
            <h1 className="text-[20px] font-semibold leading-tight">Connection declined</h1>
            <p className="text-[13px] text-[#A1A1A6] mt-2">{errorDescription || error}. You can close this tab.</p>
          </>
        ) : (
          <>
            <h1 className="text-[20px] font-semibold leading-tight">Authorized — one last step for <span className="text-white">{agent}</span></h1>
            <p className="text-[13px] text-[#A1A1A6] mt-2">
              {agent} asked to be called back at a <span className="font-mono text-[11.5px] text-[#F5F5F7]">localhost</span> address. That only works when the agent runs on this computer. If it runs in the cloud (Muse, a hosted assistant), hand it the callback yourself:
            </p>
            <div className="mt-4">
              <div className="text-[11px] uppercase tracking-wide text-[#6E6E73] mb-1">Callback URL — paste this into the agent&apos;s chat</div>
              <textarea readOnly value={callbackUrl} rows={3} onFocus={(e) => e.currentTarget.select()} className="w-full rounded-[8px] p-2.5 text-[12px] font-mono outline-none resize-none" style={mono} />
              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => copy("url")} className="h-[36px] px-4 rounded-[8px] bg-white text-black text-[12.5px] font-semibold">{copied === "url" ? "Copied" : "Copy callback URL"}</button>
                <button onClick={() => copy("code")} className="h-[36px] px-4 rounded-[8px] text-[12.5px] text-[#F5F5F7]" style={{ border: "1px solid rgba(255,255,255,0.14)" }}>{copied === "code" ? "Copied" : "Copy code only"}</button>
              </div>
            </div>
            <div className="mt-5 text-[12px] text-[#A1A1A6]">
              Agent running on this computer instead? <a href={callbackUrl} className="underline underline-offset-2 text-[#F5F5F7]">Continue to {agent}</a>.
            </div>
            <div className="mt-4 rounded-[10px] p-3 text-[12px] text-[#6E6E73]" style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.06)" }}>
              This code works once and expires in 10 minutes. It is useless without the secret the agent generated when it started the connection, so sharing it with your agent is safe. The agent is read-only and listed under Settings → Connected Agents once it finishes.
            </div>
          </>
        )}
      </div>
    </main>
  );
}
