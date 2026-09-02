"use client";

import { useState } from "react";

export default function SupportPage() {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error("Could not send message.");
      setSent(true);
      setMessage("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Support</h1>
      <p className="text-medium-gray mb-10 max-w-[560px]">
        Questions about your analysis, your score, or your account — send a
        message and the SFB Connect team will follow up by email.
      </p>

      <div className="glass rounded-[28px] p-8 max-w-[560px]">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          placeholder="How can we help?"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/40 resize-none"
        />
        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
        {sent && (
          <p className="text-sm text-green-400 mt-3">
            Message sent. We&apos;ll be in touch shortly.
          </p>
        )}
        <button
          onClick={handleSend}
          disabled={loading || !message.trim()}
          className="mt-5 bg-white text-black px-6 py-3 rounded-full text-sm font-semibold disabled:opacity-40"
        >
          {loading ? "Sending…" : "Send Message"}
        </button>
      </div>
    </div>
  );
}
