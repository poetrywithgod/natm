// One shape for every chat message in the app -- a direct parent<->teacher
// message and a Parent Model Forum message both map onto this, so the same
// thread UI renders either.
export interface ReactionSummary {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface ChatMessage {
  id: string;
  sender_id: string | null;
  /** Only forum messages carry a name (direct threads are two known people). */
  sender_name?: string;
  sender_role: string;
  body: string | null;
  audio_path: string | null;
  audio_duration_ms: number | null;
  /** Set once the server's retention period has passed and the audio file was deleted. */
  audio_deleted_at: string | null;
  created_at: string;
  /** 'system' = a join / leave / removal notice, not something a person wrote. */
  kind?: "user" | "system";
  event?: "joined" | "left" | "removed" | null;
  subject_id?: string | null;
  reply_to_id?: string | null;
  edited_at?: string | null;
  /** Set when the message was deleted -- the row stays as a tombstone. */
  deleted_at?: string | null;
  reactions?: ReactionSummary[];
}

/** Columns every chat query selects (forum adds its own on top). */
export const MESSAGE_COLUMNS =
  "id, sender_id, sender_role, body, audio_path, audio_duration_ms, audio_deleted_at, created_at, reply_to_id, edited_at, deleted_at";

export const ROLE_LABELS: Record<string, string> = {
  parent: "Parent",
  class_teacher: "Class Teacher",
  shadow_teacher: "Shadow Teacher",
  school_admin: "School Admin",
  finance_manager: "Finance Manager",
};

export function messagePreview(m: {
  body: string | null;
  audio_path: string | null;
  deleted_at?: string | null;
}): string {
  if (m.deleted_at) return "This message was deleted";
  const text = m.body?.trim();
  if (text) return text;
  return m.audio_path ? "Voice note" : "";
}

/** Who someone is, for avatars and names. Photo paths are storage paths, not URLs. */
export interface Person {
  id: string;
  name: string;
  role: string;
  photoPath: string | null;
}
