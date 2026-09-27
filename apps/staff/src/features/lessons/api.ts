import * as tus from "tus-js-client";
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

// videoId is the Mux playback id returned by pollVideoUploadStatus() after
// uploadVideoFile() finishes (see ClassTeacherLessons.tsx). summaryText is
// the manual-fallback extraction source until real captions are wired up.
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

// -- Mux upload ------------------------------------------------------------
//
// Videos never touch Supabase: the browser gets a one-time direct-upload URL
// from Mux (via the create-video-upload-url edge function, which is the
// only place the Mux API token is used) and TUS-uploads the file straight
// to Mux. Once the upload finishes, Mux still needs a few seconds to turn
// it into an asset and assign a playback id -- pollVideoUploadStatus waits
// for that. Only the resulting playback id and a derived thumbnail URL get
// saved in our own database.

export interface MuxUploadTarget {
  uploadURL: string;
  uploadId: string;
}

export async function requestVideoUploadUrl(): Promise<MuxUploadTarget> {
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
  return data as MuxUploadTarget;
}

// Mux's direct-upload URL is a pre-created TUS resource -- pass uploadUrl
// (not endpoint) so tus-js-client PATCHes straight to it instead of trying
// to create a new one.
export function uploadVideoFile(
  uploadURL: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      uploadUrl: uploadURL,
      retryDelays: [0, 1000, 3000, 5000],
      onError: (error) =>
        reject(new Error(error.message || "Video upload failed -- check your connection and try again")),
      onProgress: (bytesUploaded, bytesTotal) => {
        if (onProgress) onProgress(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}

interface VideoUploadStatus {
  uploadStatus: string;
  assetStatus: string | null;
  playbackId: string | null;
}

async function fetchVideoUploadStatus(uploadId: string): Promise<VideoUploadStatus> {
  const { data, error } = await supabase.functions.invoke("get-video-upload-status", {
    method: "POST",
    body: { uploadId },
  });
  if (error) {
    const message =
      (error as { context?: { error?: string } }).context?.error ??
      error.message ??
      "Failed to check video processing status";
    throw new Error(message);
  }
  return data as VideoUploadStatus;
}

// Mux needs a few seconds after the TUS upload finishes to turn it into an
// asset and hand back a playback id -- polls every 2s for up to 2 minutes,
// generous for a normal lesson recording. The playback id is assigned as
// soon as the asset exists; the video itself finishes processing shortly
// after and simply isn't watchable until then.
export async function pollVideoUploadStatus(uploadId: string): Promise<string> {
  const maxAttempts = 60;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await fetchVideoUploadStatus(uploadId);
    if (["errored", "cancelled", "timed_out"].includes(status.uploadStatus)) {
      throw new Error("Mux couldn't process that video -- please try uploading it again.");
    }
    if (status.playbackId) return status.playbackId;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Video is taking longer than expected to process -- please try again in a moment.");
}

export function getMuxThumbnailUrl(playbackId: string): string {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg`;
}
