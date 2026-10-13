// One shape for every chat message in the app -- a direct parent<->teacher
// message and a PTA-group message both map onto this, so the same thread
// UI renders either.
export interface ChatMessage {
  id: string;
  sender_id: string | null;
  /** Only group messages carry a name (direct threads are two known people). */
  sender_name?: string;
  sender_role: string;
  body: string | null;
  audio_path: string | null;
  audio_duration_ms: number | null;
  /** Set once the server's retention period has passed and the audio file was deleted. */
  audio_deleted_at: string | null;
  created_at: string;
}

export const ROLE_LABELS: Record<string, string> = {
  parent: "Parent",
  class_teacher: "Class Teacher",
  shadow_teacher: "Shadow Teacher",
  school_admin: "School Admin",
  finance_manager: "Finance Manager",
};

export function messagePreview(m: { body: string | null; audio_path: string | null }): string {
  const text = m.body?.trim();
  if (text) return text;
  return m.audio_path ? "Voice note" : "";
}
