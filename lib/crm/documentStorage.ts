import { createSupabaseServiceClient } from "@/lib/supabase/server";

const BUCKET = "team-documents";

export async function uploadDocumentFile(file: File, ownerId: string): Promise<{ path: string; sizeBytes: number; fileType: string }> {
  const service = createSupabaseServiceClient();
  const ext = file.name.split(".").pop() || "bin";
  const path = `${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await service.storage.from(BUCKET).upload(path, buffer, { contentType: file.type || undefined, upsert: false });
  if (error) throw new Error(error.message);

  return { path, sizeBytes: file.size, fileType: file.type || ext };
}

export async function getSignedDownloadUrl(path: string, expiresInSeconds = 300): Promise<string> {
  const service = createSupabaseServiceClient();
  const { data, error } = await service.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw new Error(error?.message || "Could not generate download link.");
  return data.signedUrl;
}

export async function deleteDocumentFile(path: string) {
  const service = createSupabaseServiceClient();
  await service.storage.from(BUCKET).remove([path]);
}
