import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { uploadDocumentFile } from "@/lib/crm/documentStorage";

const CATEGORIES = ["sales_sop", "sales_scripts", "objection_library", "ai_presence_knowledge", "website_services", "training_onboarding", "other"];

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  if (caller?.team_role !== "owner") return NextResponse.json({ error: "Only the owner can add documents." }, { status: 403 });

  const form = await req.formData();
  const title = String(form.get("title") || "").trim();
  const category = String(form.get("category") || "other");
  const description = String(form.get("description") || "");
  const visibility = form.get("visibility") === "owner_only" ? "owner_only" : "team";
  const file = form.get("file") as File | null;

  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (!CATEGORIES.includes(category)) return NextResponse.json({ error: "Invalid category." }, { status: 400 });

  const service = createSupabaseServiceClient();
  let filePath: string | null = null;
  let fileType: string | null = null;
  let fileSize: number | null = null;

  if (file && file.size > 0) {
    const uploaded = await uploadDocumentFile(file, user.id);
    filePath = uploaded.path;
    fileType = uploaded.fileType;
    fileSize = uploaded.sizeBytes;
  }

  const { data: doc, error } = await service
    .from("crm_documents")
    .insert({
      title,
      category,
      description,
      visibility,
      file_path: filePath,
      file_type: fileType,
      file_size_bytes: fileSize,
      created_by: user.id,
      updated_by: user.id,
    })
    .select("*")
    .single();

  if (error || !doc) return NextResponse.json({ error: error?.message || "Could not save document." }, { status: 400 });

  await service.from("crm_document_activity").insert({ document_id: doc.id, user_id: user.id, event_type: "created" });

  return NextResponse.json(doc);
}
