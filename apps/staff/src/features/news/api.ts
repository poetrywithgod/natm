import { supabase } from "../../lib/supabase";
import { logAuditEvent } from "../audit/api";

const NEWS_IMAGE_BUCKET = "news-images";

// Storage object keys reject many punctuation characters (e.g. "~"), which
// commonly appear in phone/camera/WhatsApp-downloaded file names. Strip
// anything unsafe before building the upload path.
function sanitizeFileName(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
  const ext = dotIndex > 0 ? name.slice(dotIndex) : "";
  const safeBase = base.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, "");
  return `${safeBase}${safeExt}`;
}

export interface NewsPost {
  id: string;
  school_id: string;
  title: string;
  excerpt: string;
  body: string;
  image_url: string | null;
  published: boolean;
  posted_by: string;
  created_at: string;
  updated_at: string;
  poster?: { full_name: string } | null;
}

export async function fetchNewsPosts(schoolId: string): Promise<NewsPost[]> {
  const { data, error } = await supabase
    .from("news_posts")
    .select("*, poster:profiles(full_name)")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as unknown as NewsPost[]) ?? [];
}

export async function uploadNewsImage(schoolId: string, file: File): Promise<string> {
  const path = `${schoolId}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage.from(NEWS_IMAGE_BUCKET).upload(path, file, {
    upsert: true,
  });
  if (uploadError) throw new Error(uploadError.message);
  const { data } = supabase.storage.from(NEWS_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function createNewsPost(input: {
  school_id: string;
  title: string;
  excerpt: string;
  body: string;
  image_url: string | null;
  published: boolean;
  posted_by: string;
}): Promise<void> {
  const { error } = await supabase.from("news_posts").insert(input);
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: input.school_id,
    actor_id: input.posted_by,
    action: "news.created",
    entity_type: "news_post",
    entity_id: null,
    details: { title: input.title, published: input.published },
  });
}

export async function updateNewsPost(
  id: string,
  schoolId: string,
  actorId: string,
  input: {
    title: string;
    excerpt: string;
    body: string;
    image_url: string | null;
  }
): Promise<void> {
  const { error } = await supabase
    .from("news_posts")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "news.updated",
    entity_type: "news_post",
    entity_id: id,
    details: { title: input.title },
  });
}

export async function setNewsPostPublished(
  id: string,
  schoolId: string,
  actorId: string,
  published: boolean
): Promise<void> {
  const { error } = await supabase
    .from("news_posts")
    .update({ published, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: published ? "news.published" : "news.retracted",
    entity_type: "news_post",
    entity_id: id,
    details: {},
  });
}

export async function deleteNewsPost(id: string, schoolId: string, actorId: string): Promise<void> {
  const { error } = await supabase.from("news_posts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "news.deleted",
    entity_type: "news_post",
    entity_id: id,
    details: {},
  });
}
