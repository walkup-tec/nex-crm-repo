import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "nex-creatives";

const MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
];

async function requireMaster(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "master")
    .maybeSingle();
  if (error) throw new Error("Não foi possível confirmar o acesso.");
  if (!data) throw new Error("Só o Master organiza os criativos.");
}

export async function ensureCreativesBucket(userId: string) {
  await requireMaster(userId);
  const existing = await supabaseAdmin.storage.getBucket(BUCKET);
  if (!existing.error && existing.data) return true as const;
  const created = await supabaseAdmin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 200 * 1024 * 1024,
    allowedMimeTypes: MIME_TYPES,
  });
  if (created.error && !/already exists|duplicate/i.test(created.error.message))
    throw new Error(created.error.message);
  return true as const;
}
