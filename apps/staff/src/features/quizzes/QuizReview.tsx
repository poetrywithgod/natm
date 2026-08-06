import { useEffect, useState } from "react";
import { X, Trash2 } from "lucide-react";
import {
  fetchQuizQuestions,
  updateQuizQuestion,
  deleteQuizQuestion,
  type QuizQuestion,
} from "./api";

interface QuizReviewProps {
  quizId: string;
  schoolId: string;
  actorId: string;
  onClose: () => void;
}

export default function QuizReview({ quizId, schoolId, actorId, onClose }: QuizReviewProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [editMarks, setEditMarks] = useState(1);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const qs = await fetchQuizQuestions(quizId);
      setQuestions(qs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load questions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  function startEdit(q: QuizQuestion) {
    setEditingId(q.id);
    setEditText(q.question_text);
    setEditAnswer(q.correct_answer);
    setEditMarks(q.marks);
  }

  async function saveEdit(questionId: string) {
    try {
      await updateQuizQuestion(
        questionId,
        { question_text: editText, correct_answer: editAnswer, marks: editMarks },
        schoolId,
        quizId,
        actorId
      );
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save question");
    }
  }

  async function handleDelete(questionId: string) {
    try {
      await deleteQuizQuestion(questionId, schoolId, quizId, actorId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete question");
    }
  }

  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-forest-950 rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto p-4 space-y-3">
        <div className="flex items-center justify-between sticky top-0 bg-forest-950 pb-2">
          <div>
            <h2 className="font-display text-lg text-forest-100">Review Quiz</h2>
            <p className="font-ui text-xs text-forest-300">
              {questions.length} questions - {totalMarks} total marks
            </p>
          </div>
          <button onClick={onClose} className="text-forest-300 hover:text-forest-100">
            <X size={20} />
          </button>
        </div>

        {error && <p className="text-error font-ui text-sm">{error}</p>}
        {loading && <p className="font-ui text-sm text-forest-300">Loading...</p>}

        {questions.map((q, i) => (
          <div key={q.id} className="bg-forest-900 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-ui text-xs text-forest-300">
                Q{i + 1} - {q.question_type === "multiple_choice" ? "Multiple Choice" : "Fill in the Blank"}
              </span>
              <button onClick={() => handleDelete(q.id)} className="text-forest-300 hover:text-red-400">
                <Trash2 size={14} />
              </button>
            </div>

            {editingId === q.id ? (
              <div className="space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={2}
                  className="w-full p-2 rounded bg-forest-700 text-forest-100 font-ui text-sm"
                />
                <input
                  type="text"
                  value={editAnswer}
                  onChange={(e) => setEditAnswer(e.target.value)}
                  placeholder="Correct answer"
                  className="w-full p-2 rounded bg-forest-700 text-forest-100 font-ui text-sm"
                />
                <input
                  type="number"
                  min={1}
                  value={editMarks}
                  onChange={(e) => setEditMarks(Number(e.target.value))}
                  className="w-24 p-2 rounded bg-forest-700 text-forest-100 font-ui text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveEdit(q.id)}
                    className="px-3 py-1.5 rounded bg-forest-500 text-forest-950 font-ui text-xs font-semibold"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1.5 rounded bg-forest-700 text-forest-100 font-ui text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => startEdit(q)} className="text-left w-full">
                <p className="font-display text-forest-100">{q.question_text}</p>
                {q.options && (
                  <ul className="mt-1 space-y-0.5">
                    {q.options.map((opt) => (
                      <li
                        key={opt}
                        className={`font-ui text-sm ${
                          opt === q.correct_answer ? "text-forest-400 font-semibold" : "text-forest-300"
                        }`}
                      >
                        {opt === q.correct_answer ? "✓ " : "- "}
                        {opt}
                      </li>
                    ))}
                  </ul>
                )}
                {!q.options && (
                  <p className="font-ui text-sm text-forest-400 mt-1">Answer: {q.correct_answer}</p>
                )}
                <p className="font-ui text-xs text-forest-300 mt-1">{q.marks} mark(s)</p>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
