import { supabase } from "../../lib/supabase";
import type { Database } from "@natm/supabase";

export type ClassLevel = Database["public"]["Enums"]["class_level"];

export const CLASS_LEVELS: { value: ClassLevel; label: string }[] = [
  { value: "creche", label: "Creche" },
  { value: "pre_nursery", label: "Pre-Nursery" },
  { value: "nursery_1", label: "Nursery 1" },
  { value: "nursery_2", label: "Nursery 2" },
  { value: "kg_1", label: "KG 1" },
  { value: "kg_2", label: "KG 2" },
  { value: "primary_1", label: "Primary 1" },
  { value: "primary_2", label: "Primary 2" },
  { value: "primary_3", label: "Primary 3" },
  { value: "primary_4", label: "Primary 4" },
  { value: "primary_5", label: "Primary 5" },
  { value: "primary_6", label: "Primary 6" },
  { value: "jss_1", label: "JSS 1" },
  { value: "jss_2", label: "JSS 2" },
  { value: "jss_3", label: "JSS 3" },
  { value: "ss_1", label: "SS 1" },
  { value: "ss_2", label: "SS 2" },
  { value: "ss_3", label: "SS 3" },
];

export interface Subject {
  id: string;
  name: string;
}

export async function fetchSubjects(): Promise<Subject[]> {
  const { data, error } = await supabase.from("subjects").select("id, name").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createSubject(name: string): Promise<Subject> {
  const { data, error } = await supabase.from("subjects").insert({ name: name.trim() }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export interface CurriculumDoc {
  id: string;
  subject_id: string;
  level: ClassLevel;
  term_number: number;
  pdf_url: string | null;
  pdf_filename: string | null;
  pdf_uploaded_at: string | null;
}

export async function fetchAllCurriculumDocs(): Promise<CurriculumDoc[]> {
  const { data, error } = await supabase
    .from("curriculum_documents")
    .select("id, subject_id, level, term_number, pdf_url, pdf_filename, pdf_uploaded_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Every (subject, level, term) slot maps to a unique curriculum_documents
// row (see the unique constraint in 20260731240000_global_curriculum.sql).
// Uploading for a slot that already has a document replaces its PDF (and
// deletes the old file from storage) rather than creating a duplicate row
// -- keeps the structured fields (learning_outcomes etc., unused by this
// PDF layer but populated by a future AI-extraction phase) intact if
// they're ever filled in later.
export async function uploadCurriculumPdf(
  subjectId: string,
  level: ClassLevel,
  termNumber: number,
  file: File
): Promise<void> {
  const { data: existing } = await supabase
    .from("curriculum_documents")
    .select("id, pdf_url")
    .eq("subject_id", subjectId)
    .eq("level", level)
    .eq("term_number", termNumber)
    .maybeSingle();

  const path = `${level}/${subjectId}/term-${termNumber}-${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("curriculum-pdfs").upload(path, file, {
    contentType: "application/pdf",
  });
  if (uploadError) throw new Error(uploadError.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from("curriculum-pdfs").getPublicUrl(path);

  if (existing) {
    const { error } = await supabase
      .from("curriculum_documents")
      .update({ pdf_url: publicUrl, pdf_filename: file.name, pdf_uploaded_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);

    if (existing.pdf_url) {
      const oldPath = existing.pdf_url.split("/curriculum-pdfs/")[1];
      if (oldPath) await supabase.storage.from("curriculum-pdfs").remove([oldPath]);
    }
  } else {
    const { error } = await supabase.from("curriculum_documents").insert({
      subject_id: subjectId,
      level,
      term_number: termNumber,
      pdf_url: publicUrl,
      pdf_filename: file.name,
      pdf_uploaded_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }
}

export async function deleteCurriculumPdf(docId: string): Promise<void> {
  const { data: doc, error: fetchError } = await supabase
    .from("curriculum_documents")
    .select("pdf_url")
    .eq("id", docId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const { error } = await supabase
    .from("curriculum_documents")
    .update({ pdf_url: null, pdf_filename: null, pdf_uploaded_at: null })
    .eq("id", docId);
  if (error) throw new Error(error.message);

  if (doc.pdf_url) {
    const path = doc.pdf_url.split("/curriculum-pdfs/")[1];
    if (path) await supabase.storage.from("curriculum-pdfs").remove([path]);
  }
}
