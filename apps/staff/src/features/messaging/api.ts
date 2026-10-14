import { uploadVoiceNote, type VoiceNoteUpload } from "@natm/supabase";
import { supabase } from "../../lib/supabase";
import { attachReactions, fetchClearedAt, subscribeToChat } from "./chatActions";
import { MESSAGE_COLUMNS, messagePreview, type ChatMessage } from "./types";

// Both of a child's teachers can have a direct thread with the parent.
export type TeacherKind = "class_teacher" | "shadow_teacher";

export interface ConversationSummary {
  id: string;
  student_id: string;
  student_name: string;
  parent_id: string;
  parent_name: string;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
}

async function summarize(
  row: {
    id: string;
    student_id: string;
    parent_id: string;
    last_message_at: string;
  },
  lastReadAt: string | null,
  studentName: string,
  parentName: string
): Promise<ConversationSummary> {
  const { data: lastMsg } = await supabase
    .from("messages")
    .select("body, audio_path, deleted_at")
    .eq("conversation_id", row.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let unreadQuery = supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", row.id)
    .eq("sender_role", "parent");
  if (lastReadAt) {
    unreadQuery = unreadQuery.gt("created_at", lastReadAt);
  }
  const { count } = await unreadQuery;

  return {
    id: row.id,
    student_id: row.student_id,
    student_name: studentName,
    parent_id: row.parent_id,
    parent_name: parentName,
    last_message_at: row.last_message_at,
    last_message_preview: lastMsg ? messagePreview(lastMsg) : null,
    unread_count: count ?? 0,
  };
}

export async function fetchConversationsForTeacher(
  teacherId: string,
  kind: TeacherKind
): Promise<ConversationSummary[]> {
  const base = supabase
    .from("conversations")
    .select(
      "id, student_id, parent_id, last_message_at, shadow_teacher_last_read_at, class_teacher_last_read_at, students(full_name), profiles!conversations_parent_id_fkey(full_name)"
    )
    .eq("teacher_kind", kind);
  const { data, error } = await (kind === "class_teacher"
    ? base.eq("class_teacher_id", teacherId)
    : base.eq("shadow_teacher_id", teacherId)
  ).order("last_message_at", { ascending: false });
  if (error) throw new Error(error.message);

  return Promise.all(
    (data ?? []).map((row) => {
      const student = Array.isArray(row.students) ? row.students[0] : row.students;
      const parent = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return summarize(
        row,
        kind === "class_teacher" ? row.class_teacher_last_read_at : row.shadow_teacher_last_read_at,
        student?.full_name ?? "—",
        parent?.full_name ?? "—"
      );
    })
  );
}

// Kept under its original name for the shadow-teacher nav badge and list.
export function fetchConversationsForShadowTeacher(shadowTeacherId: string): Promise<ConversationSummary[]> {
  return fetchConversationsForTeacher(shadowTeacherId, "shadow_teacher");
}

// One row per (student, linked parent) in the class teacher's class(es),
// with the thread's state if one exists -- so a class teacher can start a
// conversation with any of their parents, not only reply to ones who wrote first.
export interface ParentContact {
  student_id: string;
  student_name: string;
  parent_id: string;
  parent_name: string;
  conversation_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
}

export async function fetchClassTeacherContacts(teacherId: string): Promise<ParentContact[]> {
  const { data: classes, error: classError } = await supabase
    .from("classes")
    .select("id")
    .eq("class_teacher_id", teacherId);
  if (classError) throw new Error(classError.message);
  const classIds = (classes ?? []).map((c) => c.id);
  if (classIds.length === 0) return [];

  const { data: students, error: studentError } = await supabase
    .from("students")
    .select("id, full_name")
    .in("class_id", classIds);
  if (studentError) throw new Error(studentError.message);
  const studentRows = students ?? [];
  if (studentRows.length === 0) return [];

  const { data: links, error: linkError } = await supabase
    .from("parent_student_links")
    .select("student_id, parent_id")
    .in(
      "student_id",
      studentRows.map((s) => s.id)
    );
  if (linkError) throw new Error(linkError.message);
  const linkRows = links ?? [];
  if (linkRows.length === 0) return [];

  const parentIds = [...new Set(linkRows.map((l) => l.parent_id))];
  const { data: parents } = await supabase.from("profiles").select("id, full_name").in("id", parentIds);
  const parentNames = new Map((parents ?? []).map((p) => [p.id, p.full_name]));
  const studentNames = new Map(studentRows.map((s) => [s.id, s.full_name]));

  const existing = await fetchConversationsForTeacher(teacherId, "class_teacher");
  const byPair = new Map(existing.map((c) => [`${c.student_id}:${c.parent_id}`, c]));

  const contacts: ParentContact[] = linkRows.map((link) => {
    const convo = byPair.get(`${link.student_id}:${link.parent_id}`);
    return {
      student_id: link.student_id,
      student_name: studentNames.get(link.student_id) ?? "—",
      parent_id: link.parent_id,
      parent_name: parentNames.get(link.parent_id) ?? "—",
      conversation_id: convo?.id ?? null,
      last_message_at: convo?.last_message_at ?? null,
      last_message_preview: convo?.last_message_preview ?? null,
      unread_count: convo?.unread_count ?? 0,
    };
  });

  // Active threads first (newest on top), then everyone else by child's name.
  return contacts.sort((a, b) => {
    if (a.last_message_at && b.last_message_at) return b.last_message_at.localeCompare(a.last_message_at);
    if (a.last_message_at) return -1;
    if (b.last_message_at) return 1;
    return a.student_name.localeCompare(b.student_name);
  });
}

// Finds (or, on first contact, creates) the conversation for this
// student + parent + teacher kind.
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
    .select("id")
    .eq("student_id", studentId)
    .eq("parent_id", parentId)
    .eq("teacher_kind", kind)
    .maybeSingle();
  if (existing) return existing.id;

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

// Called from Student Detail's "Message Parent" button (shadow teacher).
// Uses whichever parent is linked via parent_student_links (if more than one
// parent is linked, the first is used).
export async function getOrCreateConversationForStudent(
  studentId: string,
  shadowTeacherId: string,
  schoolId: string
): Promise<string> {
  const { data: link, error: linkError } = await supabase
    .from("parent_student_links")
    .select("parent_id")
    .eq("student_id", studentId)
    .limit(1)
    .maybeSingle();
  if (linkError) throw new Error(linkError.message);
  if (!link) throw new Error("This student doesn't have a linked parent account yet.");

  return getOrCreateConversation(studentId, link.parent_id, "shadow_teacher", shadowTeacherId, schoolId);
}

export interface ConversationHeader {
  student_name: string;
  parent_name: string;
  parent_id: string;
  school_id: string;
}

// Names for the chat header, for a conversation the caller is part of.
export async function fetchConversationHeader(conversationId: string): Promise<ConversationHeader> {
  const { data: conv, error } = await supabase
    .from("conversations")
    .select("school_id, student_id, parent_id")
    .eq("id", conversationId)
    .single();
  if (error || !conv) throw new Error(error?.message ?? "Conversation not found");

  const [{ data: student }, { data: parent }] = await Promise.all([
    supabase.from("students").select("full_name").eq("id", conv.student_id).maybeSingle(),
    supabase.from("profiles").select("full_name").eq("id", conv.parent_id).maybeSingle(),
  ]);
  return {
    school_id: conv.school_id,
    student_name: student?.full_name ?? "—",
    parent_name: parent?.full_name ?? "—",
    parent_id: conv.parent_id,
  };
}

export async function fetchMessages(conversationId: string, meId: string): Promise<ChatMessage[]> {
  // "Clear chat" hides everything up to the moment it was pressed, for this person only.
  const clearedAt = await fetchClearedAt("dm", conversationId, meId);
  let query = supabase.from("messages").select(MESSAGE_COLUMNS).eq("conversation_id", conversationId);
  if (clearedAt) query = query.gt("created_at", clearedAt);
  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return attachReactions("dm", (data ?? []) as ChatMessage[], meId);
}

export interface OutgoingMessage {
  body?: string;
  voice?: VoiceNoteUpload;
  replyToId?: string | null;
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
    reply_to_id: content.replyToId ?? null,
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

export function subscribeToMessages(conversationId: string, onInsert: (msg: ChatMessage) => void, onChange: () => void) {
  return subscribeToChat({
    channel: `messages:${conversationId}`,
    table: "messages",
    filter: `conversation_id=eq.${conversationId}`,
    onInsert,
    onChange,
  });
}
