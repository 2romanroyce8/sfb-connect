"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Profile = { full_name: string | null; email: string; team_role: string; team_status: string; created_at: string };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] p-5 mb-4" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="text-[13px] font-semibold text-[#F5F5F7] mb-3">{title}</div>
      {children}
    </div>
  );
}

export default function SettingsPanel({ profile }: { profile: Profile }) {
  const [fullName, setFullName] = useState(profile.full_name || "");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  async function saveName() {
    setSavingName(true);
    setNameMsg(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase.from("users").update({ full_name: fullName }).eq("id", user!.id);
      if (error) throw error;
      setNameMsg("Saved.");
    } catch (err) {
      setNameMsg(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword() {
    if (password.length < 8) {
      setPasswordMsg("Password must be at least 8 characters.");
      return;
    }
    setSavingPassword(true);
    setPasswordMsg(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setPasswordMsg("Password updated.");
    } catch (err) {
      setPasswordMsg(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="px-8 py-8 max-w-[600px]">
      <div className="mb-6">
        <div className="text-[20px] font-semibold text-[#F5F5F7]">Settings</div>
      </div>

      <Section title="Profile">
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[11px] uppercase tracking-wide text-[#6E6E73]">Full Name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full h-[38px] rounded-[8px] px-3 text-[13px] outline-none mt-1"
              style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wide text-[#6E6E73]">Email</label>
            <div className="h-[38px] flex items-center px-3 rounded-[8px] text-[13px] text-[#6E6E73] mt-1" style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)" }}>
              {profile.email}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={saveName} disabled={savingName} className="h-[34px] px-4 rounded-[8px] bg-white text-black text-[12.5px] font-semibold disabled:opacity-60 self-start">
              {savingName ? "Saving…" : "Save"}
            </button>
            {nameMsg && <span className="text-[12px] text-[#A1A1A6]">{nameMsg}</span>}
          </div>
        </div>
      </Section>

      <Section title="Workspace">
        <div className="text-[13px] text-[#A1A1A6] capitalize">Role: {profile.team_role.replace(/_/g, " ")}</div>
        <div className="text-[13px] text-[#A1A1A6] capitalize mt-1">Status: {profile.team_status}</div>
        <div className="text-[13px] text-[#A1A1A6] mt-1">Member since {new Date(profile.created_at).toLocaleDateString()}</div>
      </Section>

      <Section title="Security">
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[11px] uppercase tracking-wide text-[#6E6E73]">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full h-[38px] rounded-[8px] px-3 text-[13px] outline-none mt-1"
              style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
            />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={savePassword} disabled={savingPassword} className="h-[34px] px-4 rounded-[8px] bg-white text-black text-[12.5px] font-semibold disabled:opacity-60 self-start">
              {savingPassword ? "Updating…" : "Update Password"}
            </button>
            {passwordMsg && <span className="text-[12px] text-[#A1A1A6]">{passwordMsg}</span>}
          </div>
        </div>
      </Section>

      <Section title="Notifications, Sales Defaults, Calendar Defaults, AI Defaults">
        <p className="text-[12.5px] text-[#6E6E73] leading-relaxed">
          These depend on the Google Calendar and AI Provider integrations, which aren't connected yet. Once
          they're set up on the Integrations page, their defaults will show up here.
        </p>
      </Section>
    </div>
  );
}
