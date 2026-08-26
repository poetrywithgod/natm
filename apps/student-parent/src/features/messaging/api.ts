import { supabase } from "../../lib/supabase";

export interface ChildConversation {
  conversation_id: string | null; // null if no conversation started yet
  student_id: string;
  student_name: string;
  shadow_teacher_id: string | null;
  shadow_teacher_name: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
}

// One row per linked child, whether or not a conversation exists yet --
// a child with no shadow teacher assigned still shows up (with a
// "not assigned yet" state) so the list matches the parent's whole family.
export async function fetchChildConversations(parentId: string): Promise<ChildConversation[]> {
  const { data: links, error: linksError } = await supabase
    .from("parent_student_links")
    .select("students(id, full_name)")
    .eq("parent_id", parentId);
  if (linksError) throw new Error(linksError.message);

  const children = (links ?? [])
    .map((row) => (Array.isArray(row.students) ? row.students[0] : row.students))
    .filter((s): s is { id: string; full_name: string } => !!s);

  const results: ChildConversation[] = [];

  for (const child of children) {
    const { data: assignment } = await supabase
      .from("shadow_teacher_assignments")
      .select("shadow_teacher_id, profiles(full_name)")
      .eq("student_id", child.id)
      .eq("is_active", true)
      .maybeSingle();

    const teacherProfile = assignment
      ? Array.isArray(assignment.profiles)
        ? assignment.profiles[0]
        : assignment.profiles
      : null;

    const { data: conversation } = await supabase
      .from("conversations")
      .select("id, last_message_at, parent_last_read_at")
      .eq("student_id", child.id)
      .eq("parent_id", parentId)
      .maybeSingle();

    let lastMessagePreview: string | null = null;
    let unreadCount = 0;

    if (conversation) {
      const { data: lastMsg } = await supabase
        .from("messages")
        .select("body")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      lastMessagePreview = lastMsg?.body ?? null;

      let unreadQuery = supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversation.id)
        .eq("sender_role", "shadow_teacher");
      if (conversation.parent_last_read_at) {
        unreadQuery = unreadQuery.gt("created_at", conversation.parent_last_read_at);
      }
      const { count } = await unreadQuery;
      unreadCount = count ?? 0;
    }

    results.push({
      conversation_id: conversation?.id ?? null,
      student_id: child.id,
      student_name: child.full_name,
      shadow_teacher_id: assignment?.shadow_teacher_id ?? null,
      shadow_teacher_name: teacherProfile?.full_name ?? null,
      last_message_at: conversation?.last_message_at ?? null,
      last_message_preview: lastMessagePreview,
      unread_count: unreadCount,
    });
  }

  return results;
}

// Called when a parent opens a child's thread for the first time --
// creates the conversation if it doesn't exist yet.
export async function getOrCreateConversation(
  studentId: string,
  parentId: string,
  shadowTeacherId: string,
  schoolId: string
): Promise<string> {
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("student_id", studentId)
    .eq("parent_id", parentId)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error: createError } = await supabase
    .from("conversations")
    .insert({ school_id: schoolId, student_id: studentId, parent_id: parentId, shadow_teacher_id: shadowTeacherId })
    .select("id")
    .single();
  if (createError) throw new Error(createError.message);
  return created.id;
}

export interface MessageRow {
  id: string;
  sender_id: string;
  sender_role: "parent" | "shadow_teacher";
  body: string;
  created_at: string;
}

export async function fetchMessages(conversationId: string): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, sender_role, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MessageRow[];
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  senderRole: "parent" | "shadow_teacher",
  body: string
): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) return;
  const { error: insertError } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, sender_role: senderRole, body: trimmed });
  if (insertError) throw new Error(insertError.message);

  await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
}

export async function markConversationRead(
  conversationId: string,
  role: "parent" | "shadow_teacher"
): Promise<void> {
  const patch =
    role === "parent"
      ? { parent_last_read_at: new Date().toISOString() }
      : { shadow_teacher_last_read_at: new Date().toISOString() };
  await supabase.from("conversations").update(patch).eq("id", conversationId);
}

export function subscribeToMessages(conversationId: string, onInsert: (msg: MessageRow) => void) {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (payload) => onInsert(payload.new as MessageRow)
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
