import { supabase } from "../../lib/supabase";
import { logAuditEvent } from "../audit/api";

export interface ClassActivity {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string;
  date: string;
  topic: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  subject_name: string;
}

export async function fetchClassActivities(classId: string, limit = 30): Promise<ClassActivity[]> {
  const { data, error } = await supabase
    .from("class_activities")
    .select("*, subject:subjects(name)")
    .eq("class_id", classId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as any[]).map((row) => ({
    ...row,
    subject_name: row.subject?.name ?? "Unknown subject",
  }));
}

export async function createClassActivity(
  schoolId: string,
  classId: string,
  subjectId: string,
  date: string,
  topic: string,
  notes: string | null,
  actorId: string
): Promise<ClassActivity> {
  const { data, error } = await supabase
    .from("class_activities")
    .insert({
      school_id: schoolId,
      class_id: classId,
      subject_id: subjectId,
      date,
      topic,
      notes,
      created_by: actorId,
    })
    .select("*, subject:subjects(name)")
    .single();
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "class_activity.logged",
    entity_type: "class",
    entity_id: classId,
    details: { subject_id: subjectId, date, topic },
  });
  return { ...(data as any), subject_name: (data as any).subject?.name ?? "Unknown subject" };
}

export async function updateClassActivity(
  activityId: string,
  topic: string,
  notes: string | null,
  schoolId: string,
  classId: string,
  actorId: string
): Promise<void> {
  const { error } = await supabase
    .from("class_activities")
    .update({ topic, notes, updated_at: new Date().toISOString() })
    .eq("id", activityId);
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "class_activity.updated",
    entity_type: "class",
    entity_id: classId,
    details: { activity_id: activityId, topic },
  });
}
