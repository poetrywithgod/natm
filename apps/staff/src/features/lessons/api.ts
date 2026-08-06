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

// videoId is whatever the teacher pastes after uploading to Cloudflare
// Stream directly (no Cloudflare account exists yet, so this is unused
// until that's set up). summaryText is the manual-fallback extraction
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
