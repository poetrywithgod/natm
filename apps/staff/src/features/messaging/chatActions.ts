import { supabase } from "../../lib/supabase";
import type { ChatMessage, Person, ReactionSummary } from "./types";

// Things you can do to a message or a chat, shared by direct threads
// ("dm") and the Parent Model Forum ("pta"). The rules (who may edit, who
// may delete, who may react) are enforced in the database functions these
// call -- the UI only decides what to show.

export type ChatKind = "dm" | "pta";

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

export async function editMessage(kind: ChatKind, id: string, body: string): Promise<void> {
  const { error } = await supabase.rpc("edit_chat_message", { p_kind: kind, p_id: id, p_body: body });
  if (error) throw new Error(error.message);
}

export async function deleteMessage(kind: ChatKind, id: string): Promise<void> {
  const { error } = await supabase.rpc("delete_chat_message", { p_kind: kind, p_id: id });
  if (error) throw new Error(error.message);
}

/** One reaction per person per message: a new emoji replaces it, the same emoji removes it. */
export async function reactToMessage(kind: ChatKind, id: string, emoji: string): Promise<void> {
  const { error } = await supabase.rpc("react_chat_message", { p_kind: kind, p_id: id, p_emoji: emoji });
  if (error) throw new Error(error.message);
}

// "Clear chat" hides everything up to now for this person only.
export async function fetchClearedAt(kind: ChatKind, targetId: string, meId: string): Promise<string | null> {
  const { data } = await supabase
    .from("chat_clears")
    .select("cleared_at")
    .eq("profile_id", meId)
    .eq("kind", kind)
    .eq("target_id", targetId)
    .maybeSingle();
  return data?.cleared_at ?? null;
}

export async function clearChat(kind: ChatKind, targetId: string, meId: string): Promise<void> {
  const { error } = await supabase
    .from("chat_clears")
    .upsert({ profile_id: meId, kind, target_id: targetId, cleared_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

const REACTION_CHUNK = 80;

// Adds a reactions summary to each message (counts per emoji + whether I reacted).
export async function attachReactions(kind: ChatKind, messages: ChatMessage[], meId: string): Promise<ChatMessage[]> {
  const ids = messages.filter((m) => m.kind !== "system" && !m.deleted_at).map((m) => m.id);
  if (ids.length === 0) return messages;

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += REACTION_CHUNK) chunks.push(ids.slice(i, i + REACTION_CHUNK));

  const rows: { message_id: string; profile_id: string; emoji: string }[] = [];
  const results = await Promise.all(
    chunks.map((chunk) =>
      supabase.from("chat_reactions").select("message_id, profile_id, emoji").eq("kind", kind).in("message_id", chunk)
    )
  );
  for (const r of results) {
    // Reactions are a nicety: if they fail to load, the messages still show.
    if (!r.error && r.data) rows.push(...r.data);
  }

  const byMessage = new Map<string, Map<string, ReactionSummary>>();
  for (const row of rows) {
    const perEmoji = byMessage.get(row.message_id) ?? new Map<string, ReactionSummary>();
    const entry = perEmoji.get(row.emoji) ?? { emoji: row.emoji, count: 0, mine: false };
    entry.count += 1;
    if (row.profile_id === meId) entry.mine = true;
    perEmoji.set(row.emoji, entry);
    byMessage.set(row.message_id, perEmoji);
  }

  return messages.map((m) => {
    const perEmoji = byMessage.get(m.id);
    return perEmoji ? { ...m, reactions: [...perEmoji.values()] } : m;
  });
}

/** A person's name / role / photo path, for the other side of a direct chat. */
export async function fetchPerson(profileId: string): Promise<Person | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, photo_url")
    .eq("id", profileId)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, name: data.full_name, role: data.role, photoPath: data.photo_url };
}

/**
 * One realtime channel per open chat: new messages, edits / deletions of
 * existing ones (UPDATE), and reactions. Anything that isn't a plain new
 * message asks the thread to reload, which keeps the rules in one place.
 */
export function subscribeToChat(opts: {
  channel: string;
  table: "messages" | "pta_messages";
  filter: string;
  onInsert: (msg: ChatMessage) => void;
  onChange: () => void;
}) {
  const channel = supabase
    .channel(opts.channel)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: opts.table, filter: opts.filter },
      (payload) => opts.onInsert(payload.new as ChatMessage)
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: opts.table, filter: opts.filter },
      () => opts.onChange()
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "chat_reactions" }, () => opts.onChange())
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
