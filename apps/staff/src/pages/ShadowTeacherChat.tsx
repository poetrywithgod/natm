import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import {
  fetchConversationsForShadowTeacher,
  fetchMessages,
  sendMessage,
  markConversationRead,
  subscribeToMessages,
  type MessageRow,
} from "../features/messaging/api";

export default function ShadowTeacherChat() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [studentName, setStudentName] = useState("");
  const [parentName, setParentName] = useState("");
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversationId || !profile?.id) return;
    let cancelled = false;

    (async () => {
      try {
        // Reuse the list endpoint for header context (student/parent names) --
        // small and already fetched app-wide, avoids a bespoke single-row query.
        const conversations = await fetchConversationsForShadowTeacher(profile.id);
        const conv = conversations.find((c) => c.id === conversationId);
        if (cancelled) return;
        if (conv) {
          setStudentName(conv.student_name);
          setParentName(conv.parent_name);
        }

        const msgs = await fetchMessages(conversationId);
        if (cancelled) return;
        setMessages(msgs);
        await markConversationRead(conversationId, "shadow_teacher");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load conversation");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId, profile?.id]);

  useEffect(() => {
    if (!conversationId) return;
    const unsubscribe = subscribeToMessages(conversationId, (msg) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      markConversationRead(conversationId, "shadow_teacher");
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
      await sendMessage(conversationId, profile.id, "shadow_teacher", body);
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
      <div className="flex items-center gap-3 p-4 bg-forest-900 sticky top-0">
        <button onClick={() => navigate("/shadow-teacher/messages")} aria-label="Back">
          <ArrowLeft size={20} className="text-forest-100" />
        </button>
        <div>
          <p className="font-display text-forest-100">{parentName}</p>
          <p className="font-ui text-xs text-forest-300">re: {studentName}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <p className="font-ui text-sm text-forest-300">Loading...</p>
        ) : error && messages.length === 0 ? (
          <p className="font-ui text-sm text-error">{error}</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender_role === "shadow_teacher" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 ${
                  m.sender_role === "shadow_teacher" ? "bg-forest-500 text-forest-950" : "bg-forest-800 text-forest-100"
                }`}
              >
                <p className="font-body text-sm whitespace-pre-wrap">{m.body}</p>
                <p
                  className={`font-ui text-[10px] mt-1 ${
                    m.sender_role === "shadow_teacher" ? "text-forest-950/60" : "text-forest-300"
                  }`}
                >
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {!loading && (
        <div className="p-3 bg-forest-900 flex items-center gap-2">
          {error && <p className="font-ui text-xs text-error absolute -mt-8">{error}</p>}
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            className="flex-1 rounded-md border border-forest-700 bg-forest-950 px-3 py-2 font-ui text-sm text-forest-100"
          />
          <button
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            className="p-2 rounded-md bg-forest-500 text-forest-950 disabled:opacity-50"
            aria-label="Send"
          >
            <Send size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
