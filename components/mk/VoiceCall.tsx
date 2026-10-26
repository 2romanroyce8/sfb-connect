"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, PhoneOff } from "lucide-react";

// Live call to the ElevenLabs conversational agent through a short-lived signed URL from /api/demo/voice (server holds the key).
// Mic audio is streamed as 16 kHz PCM; the agent's audio is played back as it arrives. The transcript comes from the service's own events.
type Line = { who: "you" | "agent"; text: string };
type Status = "idle" | "connecting" | "live" | "ended" | "error";

const b64 = (buf: ArrayBuffer) => { let s = ""; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = (s: string) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };

const WORKLET = `class P extends AudioWorkletProcessor{process(i){const c=i[0][0];if(c){const o=new Int16Array(c.length);for(let k=0;k<c.length;k++){const v=Math.max(-1,Math.min(1,c[k]));o[k]=v<0?v*32768:v*32767}this.port.postMessage(o.buffer,[o.buffer])}return true}}registerProcessor('p',P)`;

export default function VoiceCall({ trade, demo, label, onStart }: { trade?: string; demo?: { agency: string; slug: string }; label: string; onStart?: () => void }) {
  const [status, setStatus] = useState<Status>("idle"); const [lines, setLines] = useState<Line[]>([]); const [err, setErr] = useState<string | null>(null); const [secs, setSecs] = useState(0);
  const ws = useRef<WebSocket | null>(null); const ctx = useRef<AudioContext | null>(null); const stream = useRef<MediaStream | null>(null); const playAt = useRef(0); const sources = useRef<AudioBufferSourceNode[]>([]); const timer = useRef<number | null>(null);

  function stop(next: Status = "ended") {
    if (timer.current) { window.clearInterval(timer.current); timer.current = null; }
    try { ws.current?.close(); } catch { /* already closed */ }
    sources.current.forEach((s) => { try { s.stop(); } catch { /* ended */ } }); sources.current = [];
    stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null;
    void ctx.current?.close().catch(() => undefined); ctx.current = null; ws.current = null;
    setStatus((s) => (s === "error" ? s : next));
  }
  useEffect(() => () => stop("idle"), []); // eslint-disable-line react-hooks/exhaustive-deps

  function play(pcm: ArrayBuffer, rate: number) {
    const c = ctx.current; if (!c) return;
    const i16 = new Int16Array(pcm); const f = new Float32Array(i16.length); for (let k = 0; k < i16.length; k++) f[k] = i16[k] / 32768;
    const buf = c.createBuffer(1, f.length, rate); buf.copyToChannel(f, 0);
    const src = c.createBufferSource(); src.buffer = buf; src.connect(c.destination);
    const at = Math.max(c.currentTime, playAt.current); src.start(at); playAt.current = at + buf.duration; sources.current.push(src);
    src.onended = () => { sources.current = sources.current.filter((s) => s !== src); };
  }

  async function start() {
    setErr(null); setLines([]); setSecs(0); setStatus("connecting");
    try {
      const r = await fetch("/api/demo/voice", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(demo ? { agency: demo.agency, slug: demo.slug } : { trade }) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Couldn't start the call."); onStart?.();
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      const c = new AudioContext({ sampleRate: 16000 }); ctx.current = c; playAt.current = 0;
      await c.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" })));
      const node = new AudioWorkletNode(c, "p"); c.createMediaStreamSource(stream.current).connect(node);
      const sock = new WebSocket(j.signedUrl); ws.current = sock; let outRate = 16000;
      node.port.onmessage = (e) => { if (sock.readyState === WebSocket.OPEN) sock.send(JSON.stringify({ user_audio_chunk: b64(e.data as ArrayBuffer) })); };
      sock.onopen = () => sock.send(JSON.stringify({ type: "conversation_initiation_client_data", conversation_config_override: j.overrides }));
      sock.onmessage = (m) => {
        const d = JSON.parse(m.data as string);
        if (d.type === "conversation_initiation_metadata") { const f = String(d.conversation_initiation_metadata_event?.agent_output_audio_format ?? "pcm_16000"); outRate = Number(f.split("_")[1]) || 16000; setStatus("live"); }
        else if (d.type === "audio" && d.audio_event?.audio_base_64) play(fromB64(d.audio_event.audio_base_64), outRate);
        else if (d.type === "user_transcript") { const t = d.user_transcription_event?.user_transcript; if (t) setLines((l) => [...l, { who: "you", text: t }]); }
        else if (d.type === "agent_response") { const t = String(d.agent_response_event?.agent_response ?? "").replace(/\[[a-z ]{2,20}\]\s*/gi, "").trim(); if (t) setLines((l) => [...l, { who: "agent", text: t }]); }
        else if (d.type === "interruption") { sources.current.forEach((s) => { try { s.stop(); } catch { /* ended */ } }); sources.current = []; playAt.current = 0; }
        else if (d.type === "ping") sock.send(JSON.stringify({ type: "pong", event_id: d.ping_event?.event_id }));
      };
      sock.onerror = () => { setErr("The call connection failed."); setStatus("error"); stop("error"); };
      sock.onclose = () => stop("ended");
      timer.current = window.setInterval(() => setSecs((s) => { if (s + 1 >= (j.maxSeconds ?? 180)) stop("ended"); return s + 1; }), 1000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't start the call.";
      setErr(msg.includes("Permission") || msg.includes("NotAllowed") ? "Microphone access was blocked. Allow it in your browser to try the live call." : msg); setStatus("error"); stop("error");
    }
  }

  const live = status === "live" || status === "connecting";
  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap"><span className="mk-sim" style={{ borderStyle: "solid" }}>Live AI</span><span className="text-[13.5px]" style={{ color: "var(--mk-muted)" }}>{label}. A real conversation with an AI voice, not a recording. It uses your microphone; the call is limited to 3 minutes. No real booking is made.</span></div>
      <div className="rounded-[18px] p-4 min-h-[230px] flex flex-col gap-2" style={{ background: "var(--mk-bg2)", border: "1px solid var(--mk-border)" }} aria-live="polite">
        {lines.length === 0 && <div className="text-[14px] m-auto text-center" style={{ color: "var(--mk-muted)" }}>{status === "connecting" ? "Connecting…" : status === "live" ? "Listening. Say hello." : "Press Start a live call, then speak."}</div>}
        {lines.map((t, i) => <div key={i} className={`max-w-[85%] rounded-[14px] px-4 py-2.5 text-[14.5px] ${t.who === "you" ? "self-end" : "self-start"}`} style={t.who === "you" ? { background: "var(--mk-blue)", color: "var(--mk-on-blue)" } : { background: "var(--mk-white)", border: "1px solid var(--mk-border)" }}>{t.text}</div>)}
      </div>
      <div className="mt-4 flex items-center gap-3 flex-wrap">
        {!live ? <button type="button" onClick={() => void start()} className="mk-btn mk-btn-primary"><Mic size={16} aria-hidden />Start a live call</button>
          : <button type="button" onClick={() => stop("ended")} className="mk-btn mk-btn-ghost"><PhoneOff size={16} aria-hidden />End call</button>}
        {status === "live" && <span className="text-[13px]" style={{ color: "var(--mk-muted)" }}>{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")} of 3:00</span>}
        {status === "ended" && <span className="text-[13px]" style={{ color: "var(--mk-muted)" }}>Call ended.</span>}
      </div>
      {err && <div role="alert" className="mt-3 text-[13.5px]" style={{ color: "var(--mk-blue2)" }}>{err}</div>}
    </div>
  );
}
