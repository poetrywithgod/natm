import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Ban,
  Check,
  Mic,
  MoreVertical,
  Pause,
  Play,
  Send,
  Trash2,
  UserMinus,
  UserPlus,
  LogOut,
  X,
} from "lucide-react";
import {
  canRecordVoiceNotes,
  formatVoiceDuration,
  getFriendlyErrorMessage,
  hasVoiceNoteOnDevice,
  prefetchVoiceNote,
  VOICE_NOTE_MAX_MS,
  type VoiceNoteUpload,
} from "@natm/supabase";
import { supabase } from "../../lib/supabase";
import Avatar from "./Avatar";
import MessageActionSheet from "./MessageActionSheet";
import VoiceNoteBubble from "./VoiceNoteBubble";
import { deleteMessage, editMessage, reactToMessage, type ChatKind } from "./chatActions";
import { T } from "./chatTheme";
import { useVoiceRecorder } from "./useVoiceRecorder";
import { ROLE_LABELS, type ChatMessage, type Person } from "./types";

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

const SYSTEM_ICONS = { joined: UserPlus, left: LogOut, removed: UserMinus } as const;

export interface ChatMenuItem {
  label: string;
  onClick: () => void | Promise<void>;
  danger?: boolean;
}

export interface ChatThreadProps {
  /** "dm" = a direct thread, "pta" = the Parent Model Forum. */
  kind: ChatKind;
  title: string;
  subtitle?: string;
  onBack: () => void;
  /** The signed-in user's profile id -- decides which side a bubble sits on. */
  meId: string;
  /** Shown beside the title in the header. */
  headerAvatar?: ReactNode;
  /** The forum shows who sent each message. */
  showSenders?: boolean;
  /** Names and photos for the people in the chat, keyed by profile id. */
  people?: Record<string, Person>;
  /** The school admin may delete anybody's message in the forum. */
  canModerate?: boolean;
  headerAction?: ReactNode;
  /** Extra entries for the three-dot menu (e.g. "Exit group"). "Clear chat" is always there. */
  menuItems?: ChatMenuItem[];
  heightClass?: string;
  /**
   * Save every voice note that arrives to this device automatically (used for
   * direct conversations). The forum leaves it off so a busy group doesn't
   * quietly use up someone's mobile data -- notes there are saved when played.
   */
  prefetchAudio?: boolean;
  load: () => Promise<ChatMessage[]>;
  sendText: (body: string, replyToId: string | null) => Promise<void>;
  sendVoice: (recording: VoiceNoteUpload, replyToId: string | null) => Promise<void>;
  subscribe: (onInsert: (message: ChatMessage) => void, onChange: () => void) => () => void;
  markRead: () => Promise<void>;
  /** Hide everything so far, for this person only. */
  clearChat: () => Promise<void>;
  /** A join / leave / removal notice arrived -- the member list may have changed. */
  onSystemMessage?: () => void;
}

export default function ChatThread(props: ChatThreadProps) {
  const { kind, title, subtitle, onBack, meId, showSenders, people, canModerate, headerAction, headerAvatar } = props;
  const { menuItems, heightClass, prefetchAudio } = props;

  // Callbacks are read through a ref so the parent doesn't have to
  // memoize them -- the thread loads once per mount (parents give it a key).
  const callbacks = useRef(props);
  useEffect(() => {
    callbacks.current = props;
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [actionTarget, setActionTarget] = useState<ChatMessage | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastSeenId = useRef<string | null>(null);
  const reloadTimer = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const recorder = useVoiceRecorder(() => {
    void finishRecording();
  });
  const micAvailable = canRecordVoiceNotes();

  const reload = useCallback(async () => {
    setMessages(await callbacks.current.load());
  }, []);

  // Several changes can arrive together (a reaction + an edit); reload once.
  const reloadSoon = useCallback(() => {
    if (reloadTimer.current !== null) window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(() => {
      reloadTimer.current = null;
      reload().catch((err) => console.error("Chat refresh failed:", err));
    }, 250);
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await callbacks.current.load();
        if (cancelled) return;
        setMessages(loaded);
        await callbacks.current.markRead();
      } catch (err) {
        if (!cancelled) setError(getFriendlyErrorMessage(err, "Failed to load conversation"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const unsubscribe = callbacks.current.subscribe(
      (incoming) => {
        setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
        if (incoming.kind === "system") callbacks.current.onSystemMessage?.();
        if (incoming.sender_id !== meId) void callbacks.current.markRead();
      },
      reloadSoon
    );

    return () => {
      cancelled = true;
      unsubscribe();
      if (reloadTimer.current !== null) window.clearTimeout(reloadTimer.current);
    };
  }, [meId, reloadSoon]);

  // Follow the conversation down when a NEW message arrives -- but not when an
  // old one is edited or reacted to, which would yank the reader away.
  useEffect(() => {
    const last = messages.length > 0 ? messages[messages.length - 1].id : null;
    if (last !== lastSeenId.current) {
      bottomRef.current?.scrollIntoView({ behavior: lastSeenId.current === null ? "auto" : "smooth" });
      lastSeenId.current = last;
    }
  }, [messages]);

  // Direct chats: keep a copy of each voice note on this device as it arrives,
  // so it can still be played after the server deletes its copy.
  const [cacheTick, setCacheTick] = useState(0);
  useEffect(() => {
    if (!prefetchAudio) return;
    let cancelled = false;
    (async () => {
      let saved = 0;
      for (const m of messages) {
        if (cancelled) return;
        if (!m.audio_path || m.audio_deleted_at || m.deleted_at) continue;
        if (await hasVoiceNoteOnDevice(m.audio_path)) continue;
        await prefetchVoiceNote(supabase, m.audio_path);
        saved++;
      }
      if (!cancelled && saved > 0) setCacheTick((t) => t + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [messages, prefetchAudio]);

  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  function senderOf(m: ChatMessage): { name: string; role: string; photoPath: string | null } {
    const person = m.sender_id ? people?.[m.sender_id] : undefined;
    return {
      name: person?.name ?? m.sender_name ?? "Former member",
      role: person?.role ?? m.sender_role,
      photoPath: person?.photoPath ?? null,
    };
  }

  async function handleSendText() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      if (editing) {
        await editMessage(kind, editing.id, body);
        setEditing(null);
      } else {
        await callbacks.current.sendText(body, replyingTo?.id ?? null);
        setReplyingTo(null);
      }
      setDraft("");
      await reload();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, editing ? "Failed to edit message" : "Failed to send message"));
    } finally {
      setSending(false);
    }
  }

  async function finishRecording() {
    const recording = await recorder.stop();
    if (!recording) return;
    setSending(true);
    setError(null);
    try {
      await callbacks.current.sendVoice(recording, replyingTo?.id ?? null);
      setReplyingTo(null);
      await reload();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Failed to send voice note"));
    } finally {
      setSending(false);
    }
  }

  async function handleReact(message: ChatMessage, emoji: string) {
    setActionTarget(null);
    setError(null);
    try {
      await reactToMessage(kind, message.id, emoji);
      await reload();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Couldn't add your reaction"));
    }
  }

  async function handleDelete(message: ChatMessage) {
    setError(null);
    try {
      await deleteMessage(kind, message.id);
      if (replyingTo?.id === message.id) setReplyingTo(null);
      if (editing?.id === message.id) {
        setEditing(null);
        setDraft("");
      }
      setActionTarget(null);
      await reload();
    } catch (err) {
      setActionTarget(null);
      setError(getFriendlyErrorMessage(err, "Couldn't delete that message"));
    }
  }

  async function handleClear() {
    setConfirmClear(false);
    setError(null);
    try {
      await callbacks.current.clearChat();
      setReplyingTo(null);
      setEditing(null);
      setDraft("");
      await reload();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Couldn't clear the chat"));
    }
  }

  function startReply(message: ChatMessage) {
    setActionTarget(null);
    setEditing(null);
    setReplyingTo(message);
    inputRef.current?.focus();
  }

  function startEdit(message: ChatMessage) {
    setActionTarget(null);
    setReplyingTo(null);
    setEditing(message);
    setDraft(message.body ?? "");
    inputRef.current?.focus();
  }

  function cancelComposerMode() {
    setReplyingTo(null);
    setEditing(null);
    setDraft("");
  }

  function jumpTo(id: string) {
    const el = scrollerRef.current?.querySelector(`[data-msg="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(id);
    window.setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 1600);
  }

  function replyPreviewText(m: ChatMessage): string {
    if (m.deleted_at) return "This message was deleted";
    const text = m.body?.trim();
    if (text) return text;
    return m.audio_path ? "Voice note" : "";
  }

  const recordingActive = recorder.state === "recording" || recorder.state === "paused";
  const shownError = error ?? recorder.error;

  const menu: ChatMenuItem[] = [
    { label: "Clear chat", onClick: () => setConfirmClear(true), danger: true },
    ...(menuItems ?? []),
  ];

  return (
    <div className={`flex flex-col ${heightClass ?? "h-[calc(100vh-4rem)]"}`}>
      <div className={`flex items-center gap-3 p-3 ${T.headerBg} sticky top-0 z-20`}>
        <button onClick={onBack} aria-label="Back" className="p-1">
          <ArrowLeft size={20} className={T.headerText} />
        </button>
        {headerAvatar}
        <div className="min-w-0 flex-1">
          <p className={`font-display truncate ${T.headerText}`}>{title}</p>
          {subtitle && <p className={`font-ui text-xs truncate ${T.headerSub}`}>{subtitle}</p>}
        </div>
        {headerAction}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="More options"
            aria-expanded={menuOpen}
            className={`p-1.5 rounded-md ${T.headerText}`}
          >
            <MoreVertical size={20} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className={`absolute right-0 top-full mt-1 z-40 w-48 rounded-lg overflow-hidden shadow-xl ${T.sheet}`}>
                {menu.map((entry) => (
                  <button
                    key={entry.label}
                    onClick={() => {
                      setMenuOpen(false);
                      void entry.onClick();
                    }}
                    className={`w-full text-left px-4 py-3 font-ui text-sm ${T.sheetHover} ${entry.danger ? "text-red-400" : ""}`}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto p-4 space-y-1">
        {loading ? (
          <p className={`font-ui text-sm ${T.muted}`}>Loading...</p>
        ) : messages.length === 0 ? (
          <p className={`font-ui text-sm text-center mt-8 ${T.muted}`}>No messages yet. Say hello!</p>
        ) : (
          messages.map((m, i) => {
            const prev = i > 0 ? messages[i - 1] : null;
            const showDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);

            if (m.kind === "system") {
              const Icon = m.event ? SYSTEM_ICONS[m.event] : UserPlus;
              return (
                <div key={m.id} data-msg={m.id}>
                  {showDay && <DayChip label={dayLabel(m.created_at)} />}
                  <div className="flex justify-center my-2">
                    <span
                      className={`inline-flex items-center gap-1.5 font-ui text-[11px] rounded-full px-3 py-1 text-center ${T.systemNote}`}
                    >
                      <Icon size={12} className="shrink-0" />
                      {m.body}
                    </span>
                  </div>
                </div>
              );
            }

            const mine = m.sender_id === meId;
            const sender = senderOf(m);
            const startsRun = showDay || !prev || prev.kind === "system" || prev.sender_id !== m.sender_id;
            const deleted = !!m.deleted_at;
            const hasAudio = !deleted && !!m.audio_path && !!m.audio_duration_ms;
            const original = m.reply_to_id ? byId.get(m.reply_to_id) : undefined;
            const originalSender = original ? senderOf(original) : null;

            return (
              <div key={m.id} data-msg={m.id}>
                {showDay && <DayChip label={dayLabel(m.created_at)} />}
                <div className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"} ${startsRun ? "mt-2" : ""}`}>
                  {!mine && (
                    <div className="w-7 shrink-0">
                      {startsRun && (
                        <Avatar name={sender.name} role={sender.role} photoPath={sender.photoPath} size="sm" />
                      )}
                    </div>
                  )}
                  <div className={`max-w-[80%] min-w-0 flex flex-col ${mine ? "items-end" : "items-start"}`}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setActionTarget(m)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setActionTarget(m);
                        }
                      }}
                      aria-label="Message options"
                      className={`rounded-lg px-3 py-2 cursor-pointer text-left transition-shadow ${
                        mine ? T.mine : T.theirs
                      } ${highlightId === m.id ? "ring-2 ring-white/70" : ""}`}
                    >
                      {!mine && startsRun && showSenders && (
                        <p className={`font-ui text-[11px] font-semibold mb-0.5 ${T.senderName}`}>
                          {sender.name}
                          <span className={`font-normal ml-1.5 ${T.theirTime}`}>{ROLE_LABELS[sender.role] ?? ""}</span>
                        </p>
                      )}

                      {m.reply_to_id && !deleted && (
                        <div
                          onClick={(e) => {
                            if (!original) return;
                            e.stopPropagation();
                            jumpTo(original.id);
                          }}
                          className={`mb-1.5 rounded-md border-l-4 px-2 py-1 ${mine ? T.mineQuote : T.theirQuote}`}
                        >
                          <p className={`font-ui text-[11px] font-semibold ${mine ? "" : T.senderName}`}>
                            {original ? (original.sender_id === meId ? "You" : originalSender?.name) : "Original message"}
                          </p>
                          <p className="font-body text-xs opacity-80 line-clamp-2 break-words">
                            {original ? replyPreviewText(original) : "Not available"}
                          </p>
                        </div>
                      )}

                      {deleted ? (
                        <p className="font-body text-sm italic opacity-70 flex items-center gap-1.5">
                          <Ban size={14} className="shrink-0" />
                          {mine ? "You deleted this message" : "This message was deleted"}
                        </p>
                      ) : (
                        <>
                          {hasAudio && (
                            <VoiceNoteBubble
                              path={m.audio_path!}
                              durationMs={m.audio_duration_ms!}
                              mine={mine}
                              createdAt={m.created_at}
                              serverCopyGone={!!m.audio_deleted_at}
                              cacheTick={cacheTick}
                            />
                          )}
                          {m.body?.trim() && (
                            <p className={`font-body text-sm whitespace-pre-wrap break-words ${hasAudio ? "mt-1.5" : ""}`}>
                              {m.body}
                            </p>
                          )}
                        </>
                      )}

                      <p className={`font-ui text-[10px] mt-1 text-right ${mine ? T.mineTime : T.theirTime}`}>
                        {m.edited_at && !deleted && <span className="mr-1">edited ·</span>}
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>

                    {m.reactions && m.reactions.length > 0 && (
                      <div className={`flex flex-wrap gap-1 -mt-1.5 ${mine ? "justify-end pr-2" : "justify-start pl-2"}`}>
                        {m.reactions.map((r) => (
                          <button
                            key={r.emoji}
                            onClick={() => void handleReact(m, r.emoji)}
                            aria-label={`${r.emoji} ${r.count}${r.mine ? ", your reaction" : ""}`}
                            className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs ${
                              r.mine ? T.chipMine : T.chip
                            }`}
                          >
                            <span>{r.emoji}</span>
                            {r.count > 1 && <span className="font-ui text-[10px]">{r.count}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {!loading && (
        <div className={`p-3 ${T.composerBg}`}>
          {shownError && <p className="font-ui text-xs text-error mb-2">{shownError}</p>}

          {(replyingTo || editing) && !recordingActive && (
            <div className={`flex items-center gap-2 mb-2 rounded-md border-l-4 px-3 py-1.5 ${T.replyBar}`}>
              <div className="min-w-0 flex-1">
                <p className={`font-ui text-[11px] font-semibold ${T.accent}`}>
                  {editing
                    ? "Editing message"
                    : `Replying to ${replyingTo!.sender_id === meId ? "yourself" : senderOf(replyingTo!).name}`}
                </p>
                <p className={`font-body text-xs truncate ${T.muted}`}>
                  {replyPreviewText((editing ?? replyingTo)!)}
                </p>
              </div>
              <button onClick={cancelComposerMode} aria-label="Cancel" className={`p-1 ${T.muted}`}>
                <X size={16} />
              </button>
            </div>
          )}

          {recordingActive ? (
            <div className="flex items-center gap-2">
              <button
                onClick={recorder.cancel}
                className={`p-2 rounded-md ${T.muted}`}
                aria-label="Discard recording"
              >
                <Trash2 size={20} />
              </button>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${T.recordDot} ${
                    recorder.state === "recording" ? "animate-pulse" : "opacity-40"
                  }`}
                />
                <p className={`font-ui text-sm truncate ${T.headerText}`}>
                  {recorder.state === "paused" ? "Paused" : "Recording"} {formatVoiceDuration(recorder.elapsedMs)}
                  <span className={`ml-1 ${T.muted}`}>/ {formatVoiceDuration(VOICE_NOTE_MAX_MS)}</span>
                </p>
              </div>
              <button
                onClick={recorder.state === "paused" ? recorder.resume : recorder.pause}
                className={`p-2 rounded-full ${T.outlineBtn}`}
                aria-label={recorder.state === "paused" ? "Resume recording" : "Pause recording"}
              >
                {recorder.state === "paused" ? (
                  <Play size={18} fill="currentColor" />
                ) : (
                  <Pause size={18} fill="currentColor" />
                )}
              </button>
              <button
                onClick={() => void finishRecording()}
                className={`p-2 rounded-md ${T.action}`}
                aria-label="Send voice note"
              >
                <Send size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSendText();
                  if (e.key === "Escape") cancelComposerMode();
                }}
                placeholder={editing ? "Edit your message..." : "Type a message..."}
                disabled={sending}
                className={`flex-1 rounded-md border px-3 py-2 font-ui text-sm ${T.input}`}
              />
              {draft.trim() || !micAvailable || editing ? (
                <button
                  onClick={() => void handleSendText()}
                  disabled={sending || !draft.trim()}
                  className={`p-2 rounded-md disabled:opacity-50 ${T.action}`}
                  aria-label={editing ? "Save edit" : "Send"}
                >
                  {editing ? <Check size={18} /> : <Send size={18} />}
                </button>
              ) : (
                <button
                  onClick={() => void recorder.start()}
                  disabled={sending || recorder.state === "starting"}
                  className={`p-2 rounded-md disabled:opacity-50 ${T.action}`}
                  aria-label="Record a voice note"
                >
                  <Mic size={18} />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {actionTarget && (
        <MessageActionSheet
          message={actionTarget}
          canEdit={
            actionTarget.sender_id === meId &&
            !actionTarget.deleted_at &&
            !!actionTarget.body?.trim()
          }
          canDelete={
            !actionTarget.deleted_at &&
            (actionTarget.sender_id === meId || (!!canModerate && kind === "pta"))
          }
          deleteLabel={actionTarget.sender_id === meId ? "Delete" : "Delete for everyone"}
          onClose={() => setActionTarget(null)}
          onReact={(emoji) => void handleReact(actionTarget, emoji)}
          onReply={() => startReply(actionTarget)}
          onCopy={() => {
            void navigator.clipboard?.writeText(actionTarget.body ?? "").catch(() => undefined);
            setActionTarget(null);
          }}
          onEdit={() => startEdit(actionTarget)}
          onDelete={() => handleDelete(actionTarget)}
        />
      )}

      {confirmClear && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setConfirmClear(false)}
        >
          <div className={`w-full max-w-xs rounded-xl p-4 space-y-3 ${T.sheet}`} onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-base">Clear this chat?</p>
            <p className={`font-ui text-xs ${T.muted}`}>
              Everything so far is hidden for you only. The other people still see it, and new messages will appear as
              usual.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmClear(false)}
                className={`flex-1 rounded-md py-2 font-ui text-sm ${T.outlineBtn}`}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleClear()}
                className="flex-1 rounded-md py-2 font-ui text-sm font-semibold bg-red-600 text-white"
              >
                Clear chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DayChip({ label }: { label: string }) {
  return (
    <div className="flex justify-center my-2">
      <span className={`font-ui text-[10px] rounded-full px-2.5 py-0.5 ${T.divider}`}>{label}</span>
    </div>
  );
}
