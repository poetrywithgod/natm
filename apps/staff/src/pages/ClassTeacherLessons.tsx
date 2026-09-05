import { useEffect, useState } from "react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchMyClass, type MyClass } from "../features/attendance/api";
import { fetchClassSubjects, type ClassSubject } from "../features/subjects/api";
import {
  fetchLessons,
  createPdfLesson,
  createVideoLesson,
  getSignedPdfUrl,
  requestVideoUploadUrl,
  uploadVideoFile,
  getStreamThumbnailUrl,
  getStreamPlayerUrl,
  type Lesson,
  type LessonContentType,
} from "../features/lessons/api";
import { extractPdfText } from "../features/lessons/pdfText";
import {
  generateQuiz,
  fetchQuizzesForLesson,
  type Quiz,
  type QuizDifficulty,
} from "../features/quizzes/api";
import QuizReview from "../features/quizzes/QuizReview";

const DIFFICULTIES: QuizDifficulty[] = ["easy", "normal", "hard"];

export default function ClassTeacherLessons() {
  const { profile } = useAuth();
  const [myClass, setMyClass] = useState<MyClass | null>(null);
  const [subjects, setSubjects] = useState<ClassSubject[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [quizzesByLesson, setQuizzesByLesson] = useState<Record<string, Quiz[]>>({});
  const [selectedDifficulty, setSelectedDifficulty] = useState<Record<string, QuizDifficulty>>({});
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [reviewingQuizId, setReviewingQuizId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [contentType, setContentType] = useState<LessonContentType>("pdf");
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfExtracting, setPdfExtracting] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUid, setVideoUid] = useState<string | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [videoSummary, setVideoSummary] = useState("");
  const [previewingLessonId, setPreviewingLessonId] = useState<string | null>(null);

  async function loadAll() {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const cls = await fetchMyClass(profile.id);
      setMyClass(cls);
      if (cls) {
        const [subs, less] = await Promise.all([fetchClassSubjects(cls.id), fetchLessons(cls.id)]);
        setSubjects(subs);
        setLessons(less);

        const quizEntries = await Promise.all(
          less.map(async (l) => [l.id, await fetchQuizzesForLesson(l.id)] as const)
        );
        setQuizzesByLesson(Object.fromEntries(quizEntries));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load lessons");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function handlePdfSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfFile(file);
    setExtractedText("");
    setError(null);
    setPdfExtracting(true);
    try {
      const text = await extractPdfText(file);
      if (!text) {
        setError("Couldn't extract any text from that PDF -- it may be a scanned image without a text layer.");
      }
      setExtractedText(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read PDF");
    } finally {
      setPdfExtracting(false);
    }
  }

  function resetForm() {
    setTitle("");
    setSubjectId("");
    setPdfFile(null);
    setExtractedText("");
    setVideoFile(null);
    setVideoUid(null);
    setVideoUploadProgress(0);
    setVideoSummary("");
  }

  async function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);
    setVideoUid(null);
    setError(null);

    if (file.size > 200 * 1024 * 1024) {
      setError("That video is over 200MB -- trim it down or split it into shorter clips for now.");
      setVideoFile(null);
      return;
    }

    setVideoUploading(true);
    setVideoUploadProgress(0);
    try {
      const { uploadURL, uid } = await requestVideoUploadUrl();
      await uploadVideoFile(uploadURL, file, setVideoUploadProgress);
      setVideoUid(uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload video");
      setVideoFile(null);
    } finally {
      setVideoUploading(false);
    }
  }

  async function handleCreateLesson() {
    if (!myClass || !profile?.school_id || !subjectId || !title.trim()) return;

    if (contentType === "pdf" && (!pdfFile || !extractedText)) {
      setError("Select a PDF and wait for text extraction to finish before saving.");
      return;
    }
    if (contentType === "video" && (!videoUid || !videoSummary.trim())) {
      setError("Upload a video and add a summary before saving.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      if (contentType === "pdf") {
        await createPdfLesson(
          profile.school_id,
          myClass.id,
          subjectId,
          title.trim(),
          pdfFile!,
          extractedText,
          profile.id
        );
      } else {
        await createVideoLesson(
          profile.school_id,
          myClass.id,
          subjectId,
          title.trim(),
          videoUid!,
          videoSummary.trim(),
          profile.id
        );
      }
      setSuccessMessage("Lesson saved.");
      resetForm();
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save lesson");
    } finally {
      setSaving(false);
    }
  }

  async function handleViewPdf(lesson: Lesson) {
    if (!lesson.pdf_storage_path) return;
    const url = await getSignedPdfUrl(lesson.pdf_storage_path);
    if (url) window.open(url, "_blank");
    else setError("Couldn't open that PDF right now.");
  }

  async function handleGenerateQuiz(lessonId: string) {
    const difficulty = selectedDifficulty[lessonId] ?? "normal";
    setGenerating((prev) => ({ ...prev, [lessonId]: true }));
    setError(null);
    try {
      await generateQuiz(lessonId, difficulty);
      const updated = await fetchQuizzesForLesson(lessonId);
      setQuizzesByLesson((prev) => ({ ...prev, [lessonId]: updated }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate quiz");
    } finally {
      setGenerating((prev) => ({ ...prev, [lessonId]: false }));
    }
  }

  function closeReview() {
    setReviewingQuizId(null);
    loadAll();
  }

  if (loading) return <div className="p-6 font-ui text-forest-100">Loading...</div>;

  if (!myClass) {
    return (
      <div className="p-6">
        <h1 className="font-display text-2xl text-forest-100">Lessons</h1>
        <p className="font-ui text-sm text-forest-300 mt-2">
          You're not currently assigned to a class. Contact your School Admin.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      <div>
        <h1 className="font-display text-2xl text-forest-100">Lessons</h1>
        <p className="font-ui text-xs text-forest-300">{myClass.name}</p>
      </div>

      {error && <p className="text-error font-ui text-sm">{error}</p>}
      {successMessage && <p className="font-ui text-sm text-forest-300">{successMessage}</p>}

      {subjects.length === 0 ? (
        <p className="font-ui text-xs text-forest-300 bg-forest-900 rounded-lg p-3">
          No subjects have been assigned to your class yet -- ask your School Admin to add some under
          Classes.
        </p>
      ) : (
        <div className="bg-forest-900 rounded-lg p-4 space-y-3">
          <h2 className="font-ui text-sm font-semibold text-forest-100">Upload a lesson</h2>

          <div className="flex gap-2">
            <button
              onClick={() => setContentType("pdf")}
              className={`px-3 py-1.5 rounded font-ui text-xs ${
                contentType === "pdf"
                  ? "bg-forest-500 text-forest-950 font-semibold"
                  : "bg-forest-700 text-forest-100"
              }`}
            >
              PDF
            </button>
            <button
              onClick={() => setContentType("video")}
              className={`px-3 py-1.5 rounded font-ui text-xs ${
                contentType === "video"
                  ? "bg-forest-500 text-forest-950 font-semibold"
                  : "bg-forest-700 text-forest-100"
              }`}
            >
              Video
            </button>
          </div>

          <input
            type="text"
            placeholder="Lesson title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 rounded bg-forest-700 text-forest-100 font-ui text-sm placeholder:text-forest-300/60"
          />

          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full p-2 rounded bg-forest-700 text-forest-100 font-ui text-sm"
          >
            <option value="">Select subject</option>
            {subjects.map((cs) => (
              <option key={cs.subject_id} value={cs.subject_id}>
                {cs.subject.name}
              </option>
            ))}
          </select>

          {contentType === "pdf" ? (
            <div className="space-y-2">
              <input
                type="file"
                accept="application/pdf"
                onChange={handlePdfSelect}
                className="w-full text-forest-100 font-ui text-sm"
              />
              {pdfExtracting && <p className="font-ui text-xs text-forest-300">Reading PDF...</p>}
              {extractedText && !pdfExtracting && (
                <p className="font-ui text-xs text-forest-300">
                  Extracted {extractedText.length.toLocaleString()} characters of text.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoSelect}
                disabled={videoUploading}
                className="w-full text-forest-100 font-ui text-sm"
              />
              {videoFile && (
                <p className="font-ui text-xs text-forest-300 truncate">{videoFile.name}</p>
              )}
              {videoUploading && (
                <div className="space-y-1">
                  <div className="h-1.5 rounded-full bg-forest-800 overflow-hidden">
                    <div
                      className="h-full bg-forest-500 transition-all"
                      style={{ width: `${videoUploadProgress}%` }}
                    />
                  </div>
                  <p className="font-ui text-xs text-forest-300">Uploading to Cloudflare... {videoUploadProgress}%</p>
                </div>
              )}
              {videoUid && !videoUploading && (
                <p className="font-ui text-xs text-forest-300">
                  Video uploaded. It may take a few minutes to finish processing before it's watchable.
                </p>
              )}
              <textarea
                placeholder="Lesson summary (used for quiz generation until automatic captions are wired up)"
                value={videoSummary}
                onChange={(e) => setVideoSummary(e.target.value)}
                rows={4}
                className="w-full p-2 rounded bg-forest-700 text-forest-100 font-ui text-sm placeholder:text-forest-300/60"
              />
            </div>
          )}

          <button
            onClick={handleCreateLesson}
            disabled={saving || pdfExtracting || videoUploading || !subjectId || !title.trim()}
            className="px-4 py-2 rounded bg-forest-500 text-forest-950 font-ui text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Lesson"}
          </button>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="font-ui text-sm font-semibold text-forest-100">Uploaded lessons</h2>
        {lessons.length === 0 && (
          <p className="font-ui text-sm text-forest-300">No lessons uploaded yet.</p>
        )}
        {lessons.map((l) => {
          const quizzes = quizzesByLesson[l.id] ?? [];
          return (
            <div key={l.id} className="bg-forest-900 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-ui text-xs px-2 py-0.5 rounded bg-forest-700 text-forest-100">
                  {l.subject_name}
                </span>
                <span className="font-ui text-xs text-forest-300 uppercase">{l.content_type}</span>
              </div>
              <p className="font-display text-forest-100">{l.title}</p>
              {l.content_type === "pdf" && (
                <button
                  onClick={() => handleViewPdf(l)}
                  className="font-ui text-xs text-forest-300 underline"
                >
                  View PDF
                </button>
              )}
              {l.content_type === "video" && l.video_id && (
                <div className="space-y-2">
                  <button
                    onClick={() => setPreviewingLessonId(previewingLessonId === l.id ? null : l.id)}
                    className="flex items-center gap-2"
                  >
                    <img
                      src={getStreamThumbnailUrl(l.video_id)}
                      alt=""
                      className="w-20 h-12 object-cover rounded bg-forest-800"
                    />
                    <span className="font-ui text-xs text-forest-300 underline">
                      {previewingLessonId === l.id ? "Hide preview" : "Preview video"}
                    </span>
                  </button>
                  {previewingLessonId === l.id && (
                    <div className="aspect-video w-full max-w-sm rounded-lg overflow-hidden">
                      <iframe
                        src={getStreamPlayerUrl(l.video_id)}
                        className="w-full h-full"
                        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                        allowFullScreen
                        title={l.title}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-forest-700 pt-2 space-y-2">
                <div className="flex gap-2 items-center flex-wrap">
                  <select
                    value={selectedDifficulty[l.id] ?? "normal"}
                    onChange={(e) =>
                      setSelectedDifficulty((prev) => ({
                        ...prev,
                        [l.id]: e.target.value as QuizDifficulty,
                      }))
                    }
                    className="p-1.5 rounded bg-forest-700 text-forest-100 font-ui text-xs"
                  >
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>
                        {d[0].toUpperCase() + d.slice(1)}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleGenerateQuiz(l.id)}
                    disabled={generating[l.id]}
                    className="px-3 py-1.5 rounded bg-forest-500 text-forest-950 font-ui text-xs font-semibold disabled:opacity-50"
                  >
                    {generating[l.id] ? "Generating..." : "Generate Quiz"}
                  </button>
                </div>

                {quizzes.map((q) => (
                  <div
                    key={q.id}
                    className="flex items-center justify-between bg-forest-800 rounded px-2 py-1.5"
                  >
                    <span className="font-ui text-xs text-forest-100">
                      {q.difficulty[0].toUpperCase() + q.difficulty.slice(1)} quiz -{" "}
                      {q.status === "generating" && "Generating..."}
                      {q.status === "ready" && "Ready"}
                      {q.status === "failed" && "Failed"}
                    </span>
                    {q.status === "ready" && (
                      <button
                        onClick={() => setReviewingQuizId(q.id)}
                        className="font-ui text-xs text-forest-300 underline"
                      >
                        Review
                      </button>
                    )}
                    {q.status === "failed" && q.error_message && (
                      <span className="font-ui text-xs text-red-400">{q.error_message.slice(0, 60)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {reviewingQuizId && profile?.school_id && (
        <QuizReview
          quizId={reviewingQuizId}
          schoolId={profile.school_id}
          actorId={profile.id}
          onClose={closeReview}
        />
      )}
    </div>
  );
}
