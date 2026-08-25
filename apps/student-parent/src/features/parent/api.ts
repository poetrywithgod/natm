import { supabase } from "../../lib/supabase";

export interface LinkedChild {
  id: string;
  full_name: string;
  unique_student_id: string | null;
  class_id: string | null;
  class_name: string | null;
  photo_url: string | null;
}

export async function fetchLinkedChildren(parentId: string): Promise<LinkedChild[]> {
  const { data, error } = await supabase
    .from("parent_student_links")
    .select("students(id, full_name, unique_student_id, class_id, photo_url, classes(name))")
    .eq("parent_id", parentId);
  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => {
      const student = Array.isArray(row.students) ? row.students[0] : row.students;
      if (!student) return null;
      const classInfo = Array.isArray(student.classes) ? student.classes[0] : student.classes;
      return {
        id: student.id,
        full_name: student.full_name,
        unique_student_id: student.unique_student_id,
        class_id: student.class_id,
        class_name: classInfo?.name ?? null,
        photo_url: student.photo_url,
      };
    })
    .filter((c): c is LinkedChild => c !== null);
}

export async function getSignedChildPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("student-photos")
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}
