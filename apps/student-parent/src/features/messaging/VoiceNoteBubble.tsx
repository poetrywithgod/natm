import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import {
  daysUntilVoiceNoteExpires,
  formatVoiceDuration,
  getVoiceNoteBlob,
  hasVoiceNoteOnDevice,
  VOICE_NOTE_EXPIRY_WARNING_DAYS,
  VoiceNoteExpiredError,
} from "@natm/supabase";
import { supabase } from "../../lib/supabase";
import { T } from "./chatTheme";

// Only one voice note plays at a time.
let currentAudio: HTMLAudioElement | null = null;

export default function VoiceNoteBubble({
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
  const [positionMs, setPositionMs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
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
        audio.addEventListener("timeupdate", () => setPositionMs(audio.currentTime * 1000));
        audio.addEventListener("play", () => setPlaying(true));
        audio.addEventListener("pause", () => setPlaying(false));
        audio.addEventListener("ended", () => {
          setPlaying(false);
          setPositionMs(0);
        });
        audioRef.current = audio;
        setReady(true);
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

  // Tap the bar to jump to that point (once the note has been loaded).
  function seek(event: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = (ratio * durationMs) / 1000;
    setPositionMs(ratio * durationMs);
  }

  const progress = Math.min(1, positionMs / durationMs);
  const daysLeft = daysUntilVoiceNoteExpires(createdAt);
  let note: string | null = null;
  if (problem === "error") note = "Couldn't play this voice note";
  else if (unavailable || problem === "expired") note = "Voice note expired";
  else if (serverCopyGone && onDevice) note = "Saved on this device";
  else if (!serverCopyGone && onDevice === false && daysLeft <= VOICE_NOTE_EXPIRY_WARNING_DAYS) {
    note = `Expires in ${daysLeft} ${daysLeft === 1 ? "day" : "days"} · play to save`;
  }

  return (
    <div className="min-w-[13rem]" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={loading || unavailable}
          aria-label={playing ? "Pause voice note" : "Play voice note"}
          className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-60 ${
            mine ? T.mineBtn : T.theirBtn
          }`}
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : playing ? (
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" className="ml-0.5" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div
            onClick={seek}
            className={`h-2 rounded-full overflow-hidden ${ready ? "cursor-pointer" : ""} ${
              mine ? T.mineTrack : T.theirTrack
            }`}
          >
            <div className={`h-full ${mine ? T.mineFill : T.theirFill}`} style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className={`font-ui text-[11px] mt-1 tabular-nums ${mine ? T.mineTime : T.theirTime}`}>
            {formatVoiceDuration(playing || positionMs > 0 ? positionMs : 0)} / {formatVoiceDuration(durationMs)}
          </p>
        </div>
      </div>
      {note && <p className={`font-ui text-[10px] mt-1 ${mine ? T.mineTime : T.theirTime}`}>{note}</p>}
    </div>
  );
}
