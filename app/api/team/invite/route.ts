import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

// Server-only: provisions a new team member. Owner has two paths:
// 1. Default (no password given) — sends a real Supabase Auth invite email;
//    the invitee sets their own password via the link Supabase emails them.
// 2. Owner supplies a password directly (e.g. onboarding a new hire in
//    person) — we create the account with that password already set via
//    admin.createUser, so it's immediately usable. Never invented by us —
//    always exactly what the owner typed in this request.
export async function POST(req: NextRequest) {
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
    return NextResponse.json({ error: "Only the owner can invite team members." }, { status: 403 });
  }

  const body = await req.json();
  const { firstName, lastName, email, role, password } = body as {
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
    password?: string;
  };

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (role !== "owner" && role !== "sales_rep") {
    return NextResponse.json({ error: "Role must be owner or sales_rep." }, { status: 400 });
  }
  if (password && password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const service = createSupabaseServiceClient();
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || null;

  let newUserId: string;
  let teamStatus: string;

  if (password) {
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || undefined },
    });
    if (createError || !created?.user) {
      return NextResponse.json(
        { error: createError?.message || "Could not create account." },
        { status: 400 }
      );
    }
    newUserId = created.user.id;
    teamStatus = "active";
  } else {
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sfbconnect.com";
    const { data: invited, error: inviteError } = await service.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/team/login`,
    });
    if (inviteError || !invited?.user) {
      return NextResponse.json(
        { error: inviteError?.message || "Could not send invite." },
        { status: 400 }
      );
    }
    newUserId = invited.user.id;
    teamStatus = "invited";
  }

  const { error: profileError } = await service.from("users").upsert(
    {
      id: newUserId,
      email,
      first_name: firstName || null,
      last_name: lastName || null,
      full_name: fullName,
      team_role: role,
      team_status: teamStatus,
      invited_by: user.id,
      invited_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, userId: newUserId });
}
