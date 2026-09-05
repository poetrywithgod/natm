import { supabase } from "../../lib/supabase";
import { logAuditEvent } from "../audit/api";

const PDF_BUCKET = "lesson-pdfs";
const SIGNED_URL_TTL_SECONDS = 3600;

export type LessonContentType = "pdf" | "video";

export interface Lesson {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string;
  title: string;
  content_type: LessonContentType;
  pdf_storage_path: string | null;
  video_id: string | null;
  extracted_text: string | null;
  created_by: string;
  created_at: string;
  subject_name: string;
}

// Same sanitization used for photo uploads -- storage keys reject
// punctuation like "~" that commonly shows up in real file names.
function sanitizeFileName(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
  const ext = dotIndex > 0 ? name.slice(dotIndex) : "";
  const safeBase = base.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, "");
  return `${safeBase}${safeExt}`;
}

export async function fetchLessons(classId: string): Promise<Lesson[]> {
  const { data, error } = await supabase
    .from("lessons")
    .select("*, subject:subjects(name)")
    .eq("class_id", classId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as any[]).map((row) => ({
    ...row,
    subject_name: row.subject?.name ?? "Unknown subject",
  }));
}

export async function createPdfLesson(
  schoolId: string,
  classId: string,
  subjectId: string,
  title: string,
  file: File,
  extractedText: string,
  actorId: string
): Promise<Lesson> {
  const path = `${schoolId}/${classId}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage.from(PDF_BUCKET).upload(path, file);
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from("lessons")
    .insert({
      school_id: schoolId,
      class_id: classId,
      subject_id: subjectId,
      title,
      content_type: "pdf",
      pdf_storage_path: path,
      extracted_text: extractedText,
      created_by: actorId,
    })
    .select("*, subject:subjects(name)")
    .single();
  if (error) throw new Error(error.message);

  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "lesson.created",
    entity_type: "class",
    entity_id: classId,
    details: { title, content_type: "pdf", subject_id: subjectId },
  });

  return { ...(data as any), subject_name: (data as any).subject?.name ?? "Unknown subject" };
}

// videoId is the Cloudflare Stream UID returned by requestVideoUploadUrl()
// after uploadVideoFile() finishes (see ClassTeacherLessons.tsx). Still
// unexercised end-to-end until a real Cloudflare account + API token are
// configured (CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN secrets on
// create-video-upload-url). summaryText is the manual-fallback extraction
// source until real captions are wired up.
export async function createVideoLesson(
  schoolId: string,
  classId: string,
  subjectId: string,
  title: string,
  videoId: string,
  summaryText: string,
  actorId: string
): Promise<Lesson> {
  const { data, error } = await supabase
    .from("lessons")
    .insert({
      school_id: schoolId,
      class_id: classId,
      subject_id: subjectId,
      title,
      content_type: "video",
      video_id: videoId,
      extracted_text: summaryText,
      created_by: actorId,
    })
    .select("*, subject:subjects(name)")
    .single();
  if (error) throw new Error(error.message);

  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "lesson.created",
    entity_type: "class",
    entity_id: classId,
    details: { title, content_type: "video", subject_id: subjectId },
  });

  return { ...(data as any), subject_name: (data as any).subject?.name ?? "Unknown subject" };
}

export async function getSignedPdfUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(PDF_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data.signedUrl;
}

// -- Cloudflare Stream upload -------------------------------------------
//
// Videos never touch Supabase: the browser gets a one-time upload URL from
// Cloudflare (via the create-video-upload-url edge function, which is the
// only place the Cloudflare API token is used) and uploads the file
// straight to Cloudflare. Only the resulting video UID and a couple of
// derived Cloudflare URLs get saved in our own database.

export interface StreamUploadTarget {
  uploadURL: string;
  uid: string;
}

export async function requestVideoUploadUrl(): Promise<StreamUploadTarget> {
  const { data, error } = await supabase.functions.invoke("create-video-upload-url", {
    method: "POST",
  });
  if (error) {
    const message =
      (error as { context?: { error?: string } }).context?.error ??
      error.message ??
      "Failed to start video upload";
    throw new Error(message);
  }
  return data as StreamUploadTarget;
}

// Cloudflare's direct-upload endpoint accepts a plain multipart POST for
// files under 200MB (the common case for a single lesson recording) --
// no TUS client needed. Uses XHR rather than fetch so upload progress can
// be reported back to the UI.
export function uploadVideoFile(
  uploadURL: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadURL);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Video upload failed (status ${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Video upload failed -- check your connection and try again"));
    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

export function getStreamThumbnailUrl(videoId: string): string {
  return `https://videodelivery.net/${videoId}/thumbnails/thumbnail.jpg`;
}

export function getStreamPlayerUrl(videoId: string): string {
  return `https://iframe.videodelivery.net/${videoId}`;
}
