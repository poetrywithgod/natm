import { useCallback, useEffect, useRef, useState } from "react";
import {
  VOICE_NOTE_MAX_MS,
  VOICE_NOTE_MIN_MS,
  formatFromMime,
  pickRecorderFormat,
  type VoiceNoteUpload,
} from "@natm/supabase";

export type RecorderState = "idle" | "starting" | "recording" | "paused";

function friendlyMicError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access is blocked. Allow it in your browser settings to send voice notes.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No microphone was found on this device.";
  }
  return "Couldn't start recording. Please try again.";
}

/**
 * Records one voice note at a time.
 *  - start()  asks for the mic and begins recording
 *  - pause() / resume() hold and continue the same recording
 *  - stop()   finishes and resolves with the recording (null if it was
 *             too short to be intentional)
 *  - cancel() throws the recording away
 * onLimit fires once when the maximum length is reached, so the caller
 * can finish and send exactly as if the user had tapped send.
 */
export function useVoiceRecorder(onLimit?: () => void) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Recorded time = time banked from earlier stretches + the stretch now running
  // (segmentStartRef is 0 while paused).
  const bankedMsRef = useRef(0);
  const segmentStartRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const limitFiredRef = useRef(false);
  const onLimitRef = useRef(onLimit);

  useEffect(() => {
    onLimitRef.current = onLimit;
  }, [onLimit]);

  const elapsedNow = useCallback(
    () => Math.min(bankedMsRef.current + (segmentStartRef.current ? Date.now() - segmentStartRef.current : 0), VOICE_NOTE_MAX_MS),
    []
  );

  const release = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (recorderRef.current) return;
    setError(null);
    setState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const format = pickRecorderFormat();
      const recorder = format ? new MediaRecorder(stream, { mimeType: format.mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.start();
      recorderRef.current = recorder;
      bankedMsRef.current = 0;
      segmentStartRef.current = Date.now();
      limitFiredRef.current = false;
      setElapsedMs(0);
      setState("recording");
      timerRef.current = window.setInterval(() => {
        if (!segmentStartRef.current) return; // paused
        const elapsed = elapsedNow();
        setElapsedMs(elapsed);
        if (elapsed >= VOICE_NOTE_MAX_MS && !limitFiredRef.current) {
          limitFiredRef.current = true;
          onLimitRef.current?.();
        }
      }, 200);
    } catch (err) {
      release();
      setState("idle");
      setError(friendlyMicError(err));
    }
  }, [release, elapsedNow]);

  const pause = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.pause();
    bankedMsRef.current = elapsedNow();
    segmentStartRef.current = 0;
    setElapsedMs(bankedMsRef.current);
    setState("paused");
  }, [elapsedNow]);

  const resume = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    recorder.resume();
    segmentStartRef.current = Date.now();
    setState("recording");
  }, []);

  const stop = useCallback((): Promise<VoiceNoteUpload | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        release();
        setState("idle");
        resolve(null);
        return;
      }
      const durationMs = elapsedNow();
      recorder.onstop = () => {
        const format = formatFromMime(recorder.mimeType);
        const blob = new Blob(chunksRef.current, { type: format.base });
        chunksRef.current = [];
        release();
        setState("idle");
        resolve(
          durationMs >= VOICE_NOTE_MIN_MS && blob.size > 0
            ? { blob, durationMs, base: format.base, ext: format.ext }
            : null
        );
      };
      recorder.stop();
    });
  }, [release, elapsedNow]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    chunksRef.current = [];
    release();
    setState("idle");
    setElapsedMs(0);
  }, [release]);

  // Leaving the screen mid-recording must release the microphone.
  useEffect(() => cancel, [cancel]);

  return { state, elapsedMs, error, start, pause, resume, stop, cancel };
}
