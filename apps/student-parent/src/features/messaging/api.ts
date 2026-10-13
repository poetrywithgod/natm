import { uploadVoiceNote, type VoiceNoteUpload } from "@natm/supabase";
import { supabase } from "../../lib/supabase";
import { messagePreview, type ChatMessage } from "./types";

// A child can have two direct threads with the parent: one with their
// class teacher and one with their shadow teacher.
export type TeacherKind = "class_teacher" | "shadow_teacher";

export const TEACHER_KIND_LABEL: Record<TeacherKind, string> = {
  class_teacher: "Class Teacher",
  shadow_teacher: "Shadow Teacher",
};

// URL segment <-> kind. The bare /parent/messages/:studentId route predates
// class-teacher threads and means "shadow teacher".
export const KIND_TO_SLUG: Record<TeacherKind, string> = {
  class_teacher: "class-teacher",
  shadow_teacher: "shadow-teacher",
};
export function slugToKind(slug: string | undefined): TeacherKind {
  return slug === "class-teacher" ? "class_teacher" : "shadow_teacher";
}

export interface TeacherThread {
  kind: TeacherKind;
  teacher_id: string | null; // null = nobody assigned yet
  teacher_name: string | null;
  conversation_id: string | null; // null = no message sent yet
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
}

export interface ChildThreads {
  student_id: string;
  student_name: string;
  threads: TeacherThread[]; // always [class teacher, shadow teacher]
}

async function profileName(profileId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("full_name").eq("id", profileId).maybeSingle();
  return data?.full_name ?? null;
}

// Whoever currently holds the role for this child.
export async function resolveTeacher(
  studentId: string,
  kind: TeacherKind
): Promise<{ id: string; name: string | null } | null> {
  let teacherId: string | null = null;

  if (kind === "shadow_teacher") {
    const { data } = await supabase
      .from("shadow_teacher_assignments")
      .select("shadow_teacher_id")
      .eq("student_id", studentId)
      .eq("is_active", true)
      .maybeSingle();
    teacherId = data?.shadow_teacher_id ?? null;
  } else {
    const { data: student } = await supabase.from("students").select("class_id").eq("id", studentId).maybeSingle();
    if (student?.class_id) {
      const { data: cls } = await supabase
        .from("classes")
        .select("class_teacher_id")
        .eq("id", student.class_id)
        .maybeSingle();
      teacherId = cls?.class_teacher_id ?? null;
    }
  }

  if (!teacherId) return null;
  return { id: teacherId, name: await profileName(teacherId) };
}

async function fetchThread(parentId: string, studentId: string, kind: TeacherKind): Promise<TeacherThread> {
  const teacher = await resolveTeacher(studentId, kind);

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, last_message_at, parent_last_read_at")
    .eq("student_id", studentId)
    .eq("parent_id", parentId)
    .eq("teacher_kind", kind)
    .maybeSingle();

  let lastMessagePreview: string | null = null;
  let unreadCount = 0;

  if (conversation) {
    const { data: lastMsg } = await supabase
      .from("messages")
      .select("body, audio_path")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastMessagePreview = lastMsg ? messagePreview(lastMsg) : null;

    let unreadQuery = supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversation.id)
      .eq("sender_role", kind);
    if (conversation.parent_last_read_at) {
      unreadQuery = unreadQuery.gt("created_at", conversation.parent_last_read_at);
    }
    const { count } = await unreadQuery;
    unreadCount = count ?? 0;
  }

  return {
    kind,
    teacher_id: teacher?.id ?? null,
    teacher_name: teacher?.name ?? null,
    conversation_id: conversation?.id ?? null,
    last_message_at: conversation?.last_message_at ?? null,
    last_message_preview: lastMessagePreview,
    unread_count: unreadCount,
  };
}

// One entry per linked child, whether or not any thread exists yet -- a
// child with no teacher assigned still shows up (with a "not assigned yet"
// state) so the list matches the parent's whole family.
export async function fetchChildThreads(parentId: string): Promise<ChildThreads[]> {
  const { data: links, error: linksError } = await supabase
    .from("parent_student_links")
    .select("students(id, full_name)")
    .eq("parent_id", parentId);
  if (linksError) throw new Error(linksError.message);

  const children = (links ?? [])
    .map((row) => (Array.isArray(row.students) ? row.students[0] : row.students))
    .filter((s): s is { id: string; full_name: string } => !!s);

  return Promise.all(
    children.map(async (child) => ({
      student_id: child.id,
      student_name: child.full_name,
      threads: await Promise.all([
        fetchThread(parentId, child.id, "class_teacher"),
        fetchThread(parentId, child.id, "shadow_teacher"),
      ]),
    }))
  );
}

// Called when a parent opens a thread for the first time -- creates the
// conversation if it doesn't exist yet. If the child has since been given a
// different teacher, the existing thread moves to the new one (history stays
// with the parent).
export async function getOrCreateConversation(
  studentId: string,
  parentId: string,
  kind: TeacherKind,
  teacherId: string,
  schoolId: string
): Promise<string> {
  const teacherFields =
    kind === "class_teacher" ? { class_teacher_id: teacherId } : { shadow_teacher_id: teacherId };

  const { data: existing } = await supabase
    .from("conversations")
    .select("id, class_teacher_id, shadow_teacher_id")
    .eq("student_id", studentId)
    .eq("parent_id", parentId)
    .eq("teacher_kind", kind)
    .maybeSingle();

  if (existing) {
    const currentTeacherId = kind === "class_teacher" ? existing.class_teacher_id : existing.shadow_teacher_id;
    if (currentTeacherId !== teacherId) {
      await supabase.from("conversations").update(teacherFields).eq("id", existing.id);
    }
    return existing.id;
  }

  const { data: created, error: createError } = await supabase
    .from("conversations")
    .insert({
      school_id: schoolId,
      student_id: studentId,
      parent_id: parentId,
      teacher_kind: kind,
      ...teacherFields,
    })
    .select("id")
    .single();
  if (createError) throw new Error(createError.message);
  return created.id;
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, sender_role, body, audio_path, audio_duration_ms, audio_deleted_at, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ChatMessage[];
}

export interface OutgoingMessage {
  body?: string;
  voice?: VoiceNoteUpload;
}

export async function sendMessage(
  conversationId: string,
  sender: { id: string; name: string; schoolId: string },
  senderRole: "parent" | TeacherKind,
  content: OutgoingMessage
): Promise<void> {
  const body = content.body?.trim() || null;
  if (!body && !content.voice) return;

  let audioPath: string | null = null;
  if (content.voice) {
    audioPath = await uploadVoiceNote(
      supabase,
      { kind: "dm", schoolId: sender.schoolId, ownerId: conversationId },
      content.voice
    );
  }

  const { error: insertError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: sender.id,
    sender_role: senderRole,
    body,
    audio_path: audioPath,
    audio_duration_ms: content.voice ? Math.round(content.voice.durationMs) : null,
  });
  if (insertError) throw new Error(insertError.message);

  await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);

  // Notify the other party -- best-effort: the message itself already sent
  // successfully above, so a notification failure here is logged, not thrown,
  // and never surfaces as a failed send in the chat UI.
  notifyOtherParty(conversationId, sender, senderRole, body ?? "Voice note").catch((err) => {
    console.error("Failed to notify other party of new message:", err);
  });
}

// Looks up who else is on this conversation and writes them a `notifications`
// row + triggers push delivery, same pattern as Assign Work / payment-recorded
// notifications elsewhere in the app.
async function notifyOtherParty(
  conversationId: string,
  sender: { id: string; name: string },
  senderRole: "parent" | TeacherKind,
  messageBody: string
): Promise<void> {
  const { data: conv, error } = await supabase
    .from("conversations")
    .select("school_id, student_id, parent_id, shadow_teacher_id, class_teacher_id")
    .eq("id", conversationId)
    .single();
  if (error || !conv) throw new Error(error?.message ?? "Conversation not found");

  const recipientId =
    senderRole === "parent" ? conv.shadow_teacher_id ?? conv.class_teacher_id : conv.parent_id;
  if (!recipientId) return;

  const { data: student } = await supabase.from("students").select("full_name").eq("id", conv.student_id).maybeSingle();
  const studentName = student?.full_name ?? "your student";
  const preview = messageBody.length > 100 ? `${messageBody.slice(0, 100)}…` : messageBody;

  const { error: notifyError } = await supabase.from("notifications").insert({
    school_id: conv.school_id,
    recipient_id: recipientId,
    type: "message_received",
    title: `New message re: ${studentName}`,
    body: `${sender.name}: ${preview}`,
    related_entity_type: "conversation",
    related_entity_id: conversationId,
  });
  if (notifyError) throw new Error(notifyError.message);

  supabase.functions.invoke("send-push", { body: {} }).catch((err) => {
    console.error("send-push invoke failed:", err);
  });
}

export async function markConversationRead(conversationId: string, role: "parent" | TeacherKind): Promise<void> {
  const now = new Date().toISOString();
  const patch =
    role === "parent"
      ? { parent_last_read_at: now }
      : role === "class_teacher"
        ? { class_teacher_last_read_at: now }
        : { shadow_teacher_last_read_at: now };
  await supabase.from("conversations").update(patch).eq("id", conversationId);
}

export function subscribeToMessages(conversationId: string, onInsert: (msg: ChatMessage) => void) {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (payload) => onInsert(payload.new as ChatMessage)
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
