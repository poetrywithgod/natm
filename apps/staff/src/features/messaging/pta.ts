import { uploadVoiceNote, type VoiceNoteUpload } from "@natm/supabase";
import { supabase } from "../../lib/supabase";
import type { ChatMessage } from "./types";

export interface PtaOverview {
  group_id: string;
  name: string;
  member_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
}

export interface PtaMember {
  profile_id: string;
  full_name: string;
  role: string;
}

// The caller's school has exactly one PTA group; null means they aren't a
// member (e.g. a login currently in Student mode).
export async function fetchPtaOverview(): Promise<PtaOverview | null> {
  const { data, error } = await supabase.rpc("get_pta_overview");
  if (error) throw new Error(error.message);
  return data && data.length > 0 ? data[0] : null;
}

export async function fetchPtaMembers(groupId: string): Promise<PtaMember[]> {
  const { data, error } = await supabase.rpc("get_pta_members", { p_group: groupId });
  if (error) throw new Error(error.message);
  return data ?? [];
}

const HISTORY_LIMIT = 300;

// Most recent HISTORY_LIMIT messages, oldest first.
export async function fetchPtaMessages(groupId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("pta_messages")
    .select("id, sender_id, sender_name, sender_role, body, audio_path, audio_duration_ms, audio_deleted_at, created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw new Error(error.message);
  return ((data ?? []) as ChatMessage[]).reverse();
}

export async function sendPtaMessage(
  groupId: string,
  schoolId: string,
  content: { body?: string; voice?: VoiceNoteUpload }
): Promise<void> {
  const body = content.body?.trim() || null;
  if (!body && !content.voice) return;

  let audioPath: string | null = null;
  if (content.voice) {
    audioPath = await uploadVoiceNote(supabase, { kind: "pta", schoolId, ownerId: groupId }, content.voice);
  }

  // Sender, name, role and school are filled in by the database -- the client
  // only says which group and what was said.
  const { error } = await supabase.from("pta_messages").insert({
    group_id: groupId,
    body,
    audio_path: audioPath,
    audio_duration_ms: content.voice ? Math.round(content.voice.durationMs) : null,
  });
  if (error) throw new Error(error.message);

  // Members' in-app notifications are created by a database trigger; this
  // just asks the push sender to deliver them. Fire-and-forget.
  supabase.functions.invoke("send-push", { body: {} }).catch((err) => {
    console.error("send-push invoke failed:", err);
  });
}

export async function markPtaRead(groupId: string, profileId: string): Promise<void> {
  const now = new Date().toISOString();
  await supabase.from("pta_read_state").upsert({ group_id: groupId, profile_id: profileId, last_read_at: now });
  await supabase
    .from("notifications")
    .update({ read_at: now })
    .eq("recipient_id", profileId)
    .eq("type", "pta_message")
    .eq("related_entity_id", groupId)
    .is("read_at", null);
}

export function subscribeToPtaMessages(groupId: string, onInsert: (msg: ChatMessage) => void) {
  const channel = supabase
    .channel(`pta:${groupId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "pta_messages", filter: `group_id=eq.${groupId}` },
      (payload) => onInsert(payload.new as ChatMessage)
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
