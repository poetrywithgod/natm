import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Mic, Pause, Play, Send, Trash2 } from "lucide-react";
import {
  canRecordVoiceNotes,
  daysUntilVoiceNoteExpires,
  formatVoiceDuration,
  getFriendlyErrorMessage,
  getVoiceNoteBlob,
  hasVoiceNoteOnDevice,
  prefetchVoiceNote,
  VOICE_NOTE_EXPIRY_WARNING_DAYS,
  VOICE_NOTE_MAX_MS,
  VoiceNoteExpiredError,
  type VoiceNoteUpload,
} from "@natm/supabase";
import { supabase } from "../../lib/supabase";
import { useVoiceRecorder } from "./useVoiceRecorder";
import { ROLE_LABELS, type ChatMessage } from "./types";

// All colours live here so the same component can be re-themed (the
// parent app carries an identical copy with its own palette).
const T = {
  headerBg: "bg-forest-900",
  headerText: "text-forest-100",
  headerSub: "text-forest-300",
  muted: "text-forest-300",
  mine: "bg-forest-500 text-forest-950",
  mineTime: "text-forest-950/60",
  mineTrack: "bg-forest-950/20",
  mineFill: "bg-forest-950",
  mineBtn: "bg-forest-950 text-forest-400",
  theirs: "bg-forest-800 text-forest-100",
  theirTime: "text-forest-300",
  theirTrack: "bg-forest-100/20",
  theirFill: "bg-forest-400",
  theirBtn: "bg-forest-400 text-forest-950",
  senderName: "text-forest-400",
  divider: "bg-forest-900 text-forest-300",
  composerBg: "bg-forest-900",
  input: "border-forest-700 bg-forest-950 text-forest-100",
  action: "bg-forest-500 text-forest-950",
  recordDot: "bg-red-500",
};

// Only one voice note plays at a time.
let currentAudio: HTMLAudioElement | null = null;

function VoiceNoteBubble({
  path,
  durationMs,
  mine,
  createdAt,
  serverCopyGone,
  cacheTick,
}: {
  path: string;
  durationMs: number;
  mine: boolean;
  createdAt: string;
  /** The server has already deleted the audio (retention period over). */
  serverCopyGone: boolean;
  /** Bumped when background saving finishes, so the saved-state is re-read. */
  cacheTick: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<"expired" | "error" | null>(null);
  // null = still checking, true/false = whether this device holds a copy
  const [onDevice, setOnDevice] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void hasVoiceNoteOnDevice(path).then((has) => {
      if (!cancelled) setOnDevice(has);
    });
    return () => {
      cancelled = true;
    };
  }, [path, cacheTick]);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        if (currentAudio === audio) currentAudio = null;
      }
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const unavailable = serverCopyGone && onDevice === false;

  async function toggle() {
    setProblem(null);
    if (!audioRef.current) {
      setLoading(true);
      try {
        // This device's copy if there is one; otherwise downloads it and keeps a copy.
        const blob = await getVoiceNoteBlob(supabase, path, serverCopyGone);
        setOnDevice(true);
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        const audio = new Audio(url);
        audio.addEventListener("timeupdate", () => {
          setProgress(Math.min(1, (audio.currentTime * 1000) / durationMs));
        });
        audio.addEventListener("play", () => setPlaying(true));
        audio.addEventListener("pause", () => setPlaying(false));
        audio.addEventListener("ended", () => {
          setPlaying(false);
          setProgress(0);
        });
        audioRef.current = audio;
      } catch (err) {
        setProblem(err instanceof VoiceNoteExpiredError ? "expired" : "error");
        return;
      } finally {
        setLoading(false);
      }
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      if (currentAudio && currentAudio !== audio) currentAudio.pause();
      currentAudio = audio;
      try {
        await audio.play();
      } catch {
        setProblem("error");
      }
    } else {
      audio.pause();
    }
  }

  const daysLeft = daysUntilVoiceNoteExpires(createdAt);
  let status = formatVoiceDuration(durationMs);
  if (problem === "error") status = "Couldn't play this voice note";
  else if (unavailable || problem === "expired") status = "Voice note expired";
  else if (serverCopyGone && onDevice) status = `${status} · saved on this device`;
  else if (!serverCopyGone && onDevice === false && daysLeft <= VOICE_NOTE_EXPIRY_WARNING_DAYS) {
    status = `Expires in ${daysLeft} ${daysLeft === 1 ? "day" : "days"} · play to save`;
  }

  return (
    <div className="flex items-center gap-3 min-w-[11rem]">
      <button
        onClick={toggle}
        disabled={loading || unavailable}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-60 ${
          mine ? T.mineBtn : T.theirBtn
        }`}
      >
        {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>
      <div className="flex-1">
        <div className={`h-1.5 rounded-full overflow-hidden ${mine ? T.mineTrack : T.theirTrack}`}>
          <div
            className={`h-full ${mine ? T.mineFill : T.theirFill}`}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <p className={`font-ui text-[10px] mt-1 ${mine ? T.mineTime : T.theirTime}`}>{status}</p>
      </div>
    </div>
  );
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export interface ChatThreadProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  /** The signed-in user's profile id -- decides which side a bubble sits on. */
  meId: string;
  /** Group chats show who sent each message. */
  showSenders?: boolean;
  headerAction?: ReactNode;
  heightClass?: string;
  /**
   * Save every voice note that arrives to this device automatically (used for
   * direct conversations). Group chats leave it off so a busy group doesn't
   * quietly use up someone's mobile data -- notes there are saved when played.
   */
  prefetchAudio?: boolean;
  load: () => Promise<ChatMessage[]>;
  sendText: (body: string) => Promise<void>;
  sendVoice: (recording: VoiceNoteUpload) => Promise<void>;
  subscribe: (onInsert: (message: ChatMessage) => void) => () => void;
  markRead: () => Promise<void>;
}

export default function ChatThread(props: ChatThreadProps) {
  const { title, subtitle, onBack, meId, showSenders, headerAction, heightClass, prefetchAudio } = props;

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
  const bottomRef = useRef<HTMLDivElement>(null);

  const recorder = useVoiceRecorder(() => {
    void finishRecording();
  });
  const micAvailable = canRecordVoiceNotes();

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

    const unsubscribe = callbacks.current.subscribe((incoming) => {
      setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
      if (incoming.sender_id !== meId) void callbacks.current.markRead();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [meId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
        if (!m.audio_path || m.audio_deleted_at) continue;
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

  async function reload() {
    setMessages(await callbacks.current.load());
  }

  async function handleSendText() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    setDraft("");
    try {
      await callbacks.current.sendText(body);
      await reload();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Failed to send message"));
      setDraft(body);
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
      await callbacks.current.sendVoice(recording);
      await reload();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Failed to send voice note"));
    } finally {
      setSending(false);
    }
  }

  const recording = recorder.state === "recording";
  const shownError = error ?? recorder.error;

  return (
    <div className={`flex flex-col ${heightClass ?? "h-[calc(100vh-4rem)]"}`}>
      <div className={`flex items-center gap-3 p-4 ${T.headerBg} sticky top-0`}>
        <button onClick={onBack} aria-label="Back">
          <ArrowLeft size={20} className={T.headerText} />
        </button>
        <div className="min-w-0 flex-1">
          <p className={`font-display truncate ${T.headerText}`}>{title}</p>
          {subtitle && <p className={`font-ui text-xs truncate ${T.headerSub}`}>{subtitle}</p>}
        </div>
        {headerAction}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <p className={`font-ui text-sm ${T.muted}`}>Loading...</p>
        ) : messages.length === 0 ? (
          <p className={`font-ui text-sm text-center mt-8 ${T.muted}`}>No messages yet. Say hello!</p>
        ) : (
          messages.map((m, i) => {
            const mine = m.sender_id === meId;
            const showDay = i === 0 || dayLabel(messages[i - 1].created_at) !== dayLabel(m.created_at);
            const hasAudio = !!m.audio_path && !!m.audio_duration_ms;
            return (
              <div key={m.id}>
                {showDay && (
                  <div className="flex justify-center my-2">
                    <span className={`font-ui text-[10px] rounded-full px-2.5 py-0.5 ${T.divider}`}>
                      {dayLabel(m.created_at)}
                    </span>
                  </div>
                )}
                <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 ${mine ? T.mine : T.theirs}`}>
                    {showSenders && !mine && (
                      <p className={`font-ui text-[11px] font-semibold mb-0.5 ${T.senderName}`}>
                        {m.sender_name || "Former member"}
                        <span className={`font-normal ml-1.5 ${T.theirTime}`}>
                          {ROLE_LABELS[m.sender_role] ?? ""}
                        </span>
                      </p>
                    )}
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
                    {m.body?.trim() && <p className="font-body text-sm whitespace-pre-wrap">{m.body}</p>}
                    <p className={`font-ui text-[10px] mt-1 ${mine ? T.mineTime : T.theirTime}`}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
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

          {recording ? (
            <div className="flex items-center gap-3">
              <button
                onClick={recorder.cancel}
                className={`p-2 rounded-md ${T.muted}`}
                aria-label="Discard recording"
              >
                <Trash2 size={20} />
              </button>
              <div className="flex-1 flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${T.recordDot}`} />
                <p className={`font-ui text-sm ${T.headerText}`}>
                  Recording {formatVoiceDuration(recorder.elapsedMs)}
                  <span className={`ml-1 ${T.muted}`}>/ {formatVoiceDuration(VOICE_NOTE_MAX_MS)}</span>
                </p>
              </div>
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
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleSendText()}
                placeholder="Type a message..."
                disabled={sending}
                className={`flex-1 rounded-md border px-3 py-2 font-ui text-sm ${T.input}`}
              />
              {draft.trim() || !micAvailable ? (
                <button
                  onClick={() => void handleSendText()}
                  disabled={sending || !draft.trim()}
                  className={`p-2 rounded-md disabled:opacity-50 ${T.action}`}
                  aria-label="Send"
                >
                  <Send size={18} />
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
    </div>
  );
}
