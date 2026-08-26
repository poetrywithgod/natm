import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import {
  fetchChildConversations,
  getOrCreateConversation,
  fetchMessages,
  sendMessage,
  markConversationRead,
  subscribeToMessages,
  type MessageRow,
} from "../features/messaging/api";

export default function ParentChat() {
  const { studentId } = useParams<{ studentId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!studentId || !profile?.id || !profile.school_id) return;
    let cancelled = false;

    (async () => {
      try {
        const children = await fetchChildConversations(profile.id);
        const child = children.find((c) => c.student_id === studentId);
        if (!child || !child.shadow_teacher_id) {
          setError("No shadow teacher assigned to this child yet.");
          setLoading(false);
          return;
        }
        if (cancelled) return;
        setStudentName(child.student_name);
        setTeacherName(child.shadow_teacher_name ?? "Shadow Teacher");

        const convId = await getOrCreateConversation(
          studentId,
          profile.id,
          child.shadow_teacher_id,
          profile.school_id!
        );
        if (cancelled) return;
        setConversationId(convId);

        const msgs = await fetchMessages(convId);
        if (cancelled) return;
        setMessages(msgs);
        await markConversationRead(convId, "parent");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load conversation");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [studentId, profile?.id, profile?.school_id]);

  useEffect(() => {
    if (!conversationId) return;
    const unsubscribe = subscribeToMessages(conversationId, (msg) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      markConversationRead(conversationId, "parent");
    });
    return unsubscribe;
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!conversationId || !profile?.id || !draft.trim()) return;
    setSending(true);
    const body = draft;
    setDraft("");
    try {
      await sendMessage(conversationId, profile.id, "parent", body);
      const msgs = await fetchMessages(conversationId);
      setMessages(msgs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center gap-3 p-4 bg-abyssal-900 sticky top-0">
        <button onClick={() => navigate("/parent/messages")} aria-label="Back">
          <ArrowLeft size={20} className="text-abyssal-100" />
        </button>
        <div>
          <p className="font-display text-abyssal-100">{teacherName}</p>
          <p className="font-ui text-xs text-abyssal-300">re: {studentName}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <p className="font-ui text-sm text-abyssal-300">Loading...</p>
        ) : error && messages.length === 0 ? (
          <p className="font-ui text-sm text-error">{error}</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender_role === "parent" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 ${
                  m.sender_role === "parent" ? "bg-lime text-abyssal-950" : "bg-abyssal-800 text-abyssal-100"
                }`}
              >
                <p className="font-body text-sm whitespace-pre-wrap">{m.body}</p>
                <p className={`font-ui text-[10px] mt-1 ${m.sender_role === "parent" ? "text-abyssal-950/60" : "text-abyssal-300"}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {!loading && conversationId && (
        <div className="p-3 bg-abyssal-900 flex items-center gap-2">
          {error && <p className="font-ui text-xs text-error absolute -mt-8">{error}</p>}
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            className="flex-1 rounded-md border border-abyssal-700 bg-abyssal-950 px-3 py-2 font-ui text-sm text-abyssal-100"
          />
          <button
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            className="p-2 rounded-md bg-lime text-abyssal-950 disabled:opacity-50"
            aria-label="Send"
          >
            <Send size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
