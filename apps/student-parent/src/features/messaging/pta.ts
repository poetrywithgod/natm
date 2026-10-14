import { uploadVoiceNote, type VoiceNoteUpload } from "@natm/supabase";
import { supabase } from "../../lib/supabase";
import { attachReactions, fetchClearedAt, subscribeToChat } from "./chatActions";
import { MESSAGE_COLUMNS, type ChatMessage } from "./types";

// The Parent Model Forum (the database still calls it the "PTA group").
// Only the school admin is in it by default; everyone else joins by invitation.

export const FORUM_NAME = "Parent Model Forum";

export interface PtaOverview {
  group_id: string;
  name: string;
  member_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  /** 'active' = in the forum; 'invited' = an invitation is waiting for an answer. */
  my_status: "active" | "invited";
  is_admin: boolean;
  invited_by_name: string | null;
}

export interface PtaMember {
  profile_id: string;
  full_name: string;
  role: string;
  photo_url: string | null;
  status: "active" | "invited";
  joined_at: string | null;
}

export interface InvitableProfile {
  profile_id: string;
  full_name: string;
  role: string;
  photo_url: string | null;
  /** A parent's children / a class teacher's class -- helps tell people apart. */
  detail: string | null;
  previous_status: string | null;
}

// The caller's forum, or null when they can't be in one (e.g. a family login
// currently in Student mode) or have neither joined nor been invited.
export async function fetchPtaOverview(): Promise<PtaOverview | null> {
  const { data, error } = await supabase.rpc("get_pta_overview");
  if (error) throw new Error(error.message);
  return data && data.length > 0 ? (data[0] as PtaOverview) : null;
}

export async function fetchPtaMembers(groupId: string): Promise<PtaMember[]> {
  const { data, error } = await supabase.rpc("get_pta_members", { p_group: groupId });
  if (error) throw new Error(error.message);
  return (data ?? []) as PtaMember[];
}

export async function fetchInvitable(groupId: string): Promise<InvitableProfile[]> {
  const { data, error } = await supabase.rpc("get_forum_invitable", { p_group: groupId });
  if (error) throw new Error(error.message);
  return (data ?? []) as InvitableProfile[];
}

function nudgePush() {
  // In-app notifications are created by the database; this just asks the
  // push sender to deliver them. Fire-and-forget.
  supabase.functions.invoke("send-push", { body: {} }).catch((err) => {
    console.error("send-push invoke failed:", err);
  });
}

export async function inviteToForum(groupId: string, profileIds: string[]): Promise<number> {
  const { data, error } = await supabase.rpc("invite_to_forum", { p_group: groupId, p_profiles: profileIds });
  if (error) throw new Error(error.message);
  nudgePush();
  return data ?? 0;
}

export async function respondToForumInvite(groupId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc("respond_to_forum_invite", { p_group: groupId, p_accept: accept });
  if (error) throw new Error(error.message);
  nudgePush();
}

export async function leaveForum(groupId: string): Promise<void> {
  const { error } = await supabase.rpc("leave_forum", { p_group: groupId });
  if (error) throw new Error(error.message);
}

export async function removeFromForum(groupId: string, profileId: string): Promise<void> {
  const { error } = await supabase.rpc("remove_from_forum", { p_group: groupId, p_profile: profileId });
  if (error) throw new Error(error.message);
  nudgePush();
}

const HISTORY_LIMIT = 300;

// Most recent HISTORY_LIMIT messages since this person joined (and since they
// last cleared the chat), oldest first.
export async function fetchPtaMessages(groupId: string, meId: string): Promise<ChatMessage[]> {
  const clearedAt = await fetchClearedAt("pta", groupId, meId);
  let query = supabase
    .from("pta_messages")
    .select(`${MESSAGE_COLUMNS}, sender_name, kind, event, subject_id`)
    .eq("group_id", groupId);
  if (clearedAt) query = query.gt("created_at", clearedAt);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(HISTORY_LIMIT);
  if (error) throw new Error(error.message);
  const messages = ((data ?? []) as unknown as ChatMessage[]).reverse();
  return attachReactions("pta", messages, meId);
}

export async function sendPtaMessage(
  groupId: string,
  schoolId: string,
  content: { body?: string; voice?: VoiceNoteUpload; replyToId?: string | null }
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
    reply_to_id: content.replyToId ?? null,
  });
  if (error) throw new Error(error.message);
  nudgePush();
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

export function subscribeToPtaMessages(groupId: string, onInsert: (msg: ChatMessage) => void, onChange: () => void) {
  return subscribeToChat({
    channel: `pta:${groupId}`,
    table: "pta_messages",
    filter: `group_id=eq.${groupId}`,
    onInsert,
    onChange,
  });
}
