"use client";

import { useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Profile = {
  full_name: string | null;
  email: string;
  team_role: string;
  team_status: string;
  created_at: string;
  avatar_url?: string | null;
};

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="rounded-[12px] p-5 mb-4 scroll-mt-6" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="text-[13px] font-semibold text-[#F5F5F7] mb-3">{title}</div>
      {children}
    </div>
  );
}

export default function SettingsPanel({ profile }: { profile: Profile }) {
  const [fullName, setFullName] = useState(profile.full_name || "");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<string | null>(null);

  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadAvatar(file: File) {
    if (!file.type.startsWith("image/")) {
      setAvatarMsg("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarMsg("Image must be under 5MB.");
      return;
    }
    setUploadingAvatar(true);
    setAvatarMsg(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");
      const ext = file.name.split(".").pop() || "jpg";
      // Path is namespaced by user id -- storage RLS only allows each user to
      // write inside their own folder, so this can never overwrite a
      // teammate's avatar.
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      // Cache-bust so the new image shows immediately instead of the old
      // one lingering under an identical URL.
      const url = `${pub.publicUrl}?v=${Date.now()}`;
      const { error: dbError } = await supabase.from("users").update({ avatar_url: url }).eq("id", user.id);
      if (dbError) throw dbError;
      setAvatarUrl(url);
      setAvatarMsg("Photo updated.");
    } catch (err) {
      setAvatarMsg(err instanceof Error ? err.message : "Could not upload photo.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function removeAvatar() {
    setUploadingAvatar(true);
    setAvatarMsg(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");
      const { error } = await supabase.from("users").update({ avatar_url: null }).eq("id", user.id);
      if (error) throw error;
      setAvatarUrl(null);
      setAvatarMsg("Photo removed.");
    } catch (err) {
      setAvatarMsg(err instanceof Error ? err.message : "Could not remove photo.");
    } finally {
      setUploadingAvatar(false);
    }
  }

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

      <Section title="Profile" id="profile">
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[11px] uppercase tracking-wide text-[#6E6E73]">Photo</label>
            <div className="flex items-center gap-4 mt-1.5">
              <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 flex items-center justify-center" style={{ background: "#1c1c1e", border: "1px solid rgba(255,255,255,0.08)" }}>
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Your profile photo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[20px] font-semibold text-[#F5F5F7]">
                    {(fullName || profile.email || "?").slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="h-[32px] px-3.5 rounded-[8px] bg-white text-black text-[12px] font-semibold disabled:opacity-60"
                  >
                    {uploadingAvatar ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
                  </button>
                  {avatarUrl && (
                    <button
                      onClick={removeAvatar}
                      disabled={uploadingAvatar}
                      className="h-[32px] px-3.5 rounded-[8px] text-[12px] text-[#A1A1A6] disabled:opacity-60"
                      style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                {avatarMsg && <span className="text-[12px] text-[#A1A1A6]">{avatarMsg}</span>}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadAvatar(file);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
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

      <Section title="Security" id="security">
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
