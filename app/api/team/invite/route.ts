import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

// Server-only: sends a real Supabase Auth invite email and provisions the
// team profile row. Never invents credentials — the invitee sets their own
// password via the link Supabase emails them.
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
  const { firstName, lastName, email, role } = body as {
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
  };

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (role !== "owner" && role !== "sales_rep") {
    return NextResponse.json({ error: "Role must be owner or sales_rep." }, { status: 400 });
  }

  const service = createSupabaseServiceClient();

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

  const { error: profileError } = await service.from("users").upsert(
    {
      id: invited.user.id,
      email,
      first_name: firstName || null,
      last_name: lastName || null,
      full_name: [firstName, lastName].filter(Boolean).join(" ") || null,
      team_role: role,
      team_status: "invited",
      invited_by: user.id,
      invited_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, userId: invited.user.id });
}
