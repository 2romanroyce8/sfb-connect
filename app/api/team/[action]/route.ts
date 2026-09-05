import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

// Handles: resend-invite | reset-access | deactivate | activate | reassign
// All are owner-only, server-only actions against real Supabase Auth /
// the users table. No fake success responses.
export async function POST(
  req: NextRequest,
  { params }: { params: { action: string } }
) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: caller } = await supabase
    .from("users")
    .select("team_role")
    .eq("id", user.id)
    .single();
  if (caller?.team_role !== "owner") {
    return NextResponse.json({ error: "Owner access required." }, { status: 403 });
  }

  const body = await req.json();
  const { userId, leadIds } = body as { userId?: string; leadIds?: string[] };
  const service = createSupabaseServiceClient();
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sfbconnect.com";

  switch (params.action) {
    case "resend-invite": {
      if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
      const { data: profile } = await service.from("users").select("email").eq("id", userId).single();
      if (!profile?.email) return NextResponse.json({ error: "User not found" }, { status: 404 });
      const { error } = await service.auth.admin.inviteUserByEmail(profile.email, {
        redirectTo: `${siteUrl}/team/login`,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await service.from("users").update({ invited_at: new Date().toISOString() }).eq("id", userId);
      return NextResponse.json({ success: true });
    }

    case "reset-access": {
      if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
      const { data: profile } = await service.from("users").select("email").eq("id", userId).single();
      if (!profile?.email) return NextResponse.json({ error: "User not found" }, { status: 404 });
      const { error } = await service.auth.resetPasswordForEmail(profile.email, {
        redirectTo: `${siteUrl}/team/login`,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    case "deactivate": {
      if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
      const { error } = await service.from("users").update({ team_status: "disabled" }).eq("id", userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await service.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
      return NextResponse.json({ success: true });
    }

    case "activate": {
      if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
      const { error } = await service.from("users").update({ team_status: "active" }).eq("id", userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await service.auth.admin.updateUserById(userId, { ban_duration: "none" });
      return NextResponse.json({ success: true });
    }

    case "reassign-leads": {
      if (!userId || !leadIds?.length)
        return NextResponse.json({ error: "userId and leadIds required" }, { status: 400 });
      const { error } = await service.from("crm_leads").update({ assigned_rep: userId }).in("id", leadIds);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 404 });
  }
}
