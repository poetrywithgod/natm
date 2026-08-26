import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { fetchChildConversations, type ChildConversation } from "../features/messaging/api";

export default function ParentMessages() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ChildConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    fetchChildConversations(profile.id)
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
      <h1 className="font-display text-xl text-abyssal-100">Messages</h1>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-16 rounded-lg bg-abyssal-900" />
          <div className="h-16 rounded-lg bg-abyssal-900" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="bg-abyssal-900 rounded-lg p-6 text-center">
          <MessageCircle className="mx-auto text-abyssal-300 mb-2" size={24} />
          <p className="font-body text-sm text-abyssal-300">No children linked yet.</p>
        </div>
      ) : (
        conversations.map((c) => (
          <button
            key={c.student_id}
            onClick={() => c.shadow_teacher_id && navigate(`/parent/messages/${c.student_id}`)}
            disabled={!c.shadow_teacher_id}
            className="w-full text-left bg-abyssal-900 rounded-lg p-4 flex items-center justify-between disabled:opacity-60"
          >
            <div className="min-w-0">
              <p className="font-ui text-sm text-abyssal-100">{c.student_name}</p>
              {c.shadow_teacher_name ? (
                <>
                  <p className="font-ui text-xs text-abyssal-300">Shadow Teacher: {c.shadow_teacher_name}</p>
                  {c.last_message_preview && (
                    <p className="font-ui text-xs text-abyssal-300 truncate mt-0.5">{c.last_message_preview}</p>
                  )}
                </>
              ) : (
                <p className="font-ui text-xs text-abyssal-300">No shadow teacher assigned yet</p>
              )}
            </div>
            {c.unread_count > 0 && (
              <span className="shrink-0 ml-3 bg-lime text-abyssal-950 text-xs font-ui font-semibold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">
                {c.unread_count > 9 ? "9+" : c.unread_count}
              </span>
            )}
          </button>
        ))
      )}
    </div>
  );
}
