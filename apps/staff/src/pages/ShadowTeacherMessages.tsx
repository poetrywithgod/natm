import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchConversationsForShadowTeacher, type ConversationSummary } from "../features/messaging/api";

export default function ShadowTeacherMessages() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    fetchConversationsForShadowTeacher(profile.id)
      .then((rows) => {
        if (!cancelled) setConversations(rows);
      })
      .catch((err) => console.error("Failed to load conversations:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  return (
    <div className="p-4 space-y-3">
      <h1 className="font-display text-xl text-forest-100">Messages</h1>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-16 rounded-lg bg-forest-900" />
          <div className="h-16 rounded-lg bg-forest-900" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="bg-forest-900 rounded-lg p-6 text-center">
          <MessageCircle className="mx-auto text-forest-300 mb-2" size={24} />
          <p className="font-body text-sm text-forest-300">
            No conversations yet. Start one from a student's profile.
          </p>
        </div>
      ) : (
        conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => navigate(`/shadow-teacher/messages/${c.id}`)}
            className="w-full text-left bg-forest-900 rounded-lg p-4 flex items-center justify-between"
          >
            <div className="min-w-0">
              <p className="font-ui text-sm text-forest-100">{c.parent_name}</p>
              <p className="font-ui text-xs text-forest-300">re: {c.student_name}</p>
              {c.last_message_preview && (
                <p className="font-ui text-xs text-forest-300 truncate mt-0.5">{c.last_message_preview}</p>
              )}
            </div>
            {c.unread_count > 0 && (
              <span className="shrink-0 ml-3 bg-red-500 text-white text-xs font-ui font-semibold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">
                {c.unread_count > 9 ? "9+" : c.unread_count}
              </span>
            )}
          </button>
        ))
      )}
    </div>
  );
}
