import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getFriendlyErrorMessage } from "@natm/supabase";
import { useAuth } from "../features/auth/AuthContext";
import ChatThread from "../features/messaging/ChatThread";
import {
  fetchConversationHeader,
  fetchMessages,
  markConversationRead,
  sendMessage,
  subscribeToMessages,
  type ConversationHeader,
  type TeacherKind,
} from "../features/messaging/api";

// A direct thread between one of a child's teachers and a parent. The
// same screen serves the shadow teacher and the class teacher; `kind` is
// the signed-in teacher's own role in the thread.
export default function TeacherChat({ kind, listPath }: { kind: TeacherKind; listPath: string }) {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [header, setHeader] = useState<ConversationHeader | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    fetchConversationHeader(conversationId)
      .then((h) => {
        if (!cancelled) setHeader(h);
      })
      .catch((err) => {
        if (!cancelled) setError(getFriendlyErrorMessage(err, "Failed to load conversation"));
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  if (error) {
    return (
      <div className="p-4">
        <button onClick={() => navigate(listPath)} className="font-ui text-sm text-forest-300 mb-3">
          ← Back
        </button>
        <p className="font-ui text-sm text-error">{error}</p>
      </div>
    );
  }
  if (!conversationId || !header || !profile?.school_id) {
    return <p className="p-4 font-ui text-sm text-forest-300">Loading...</p>;
  }

  const sender = { id: profile.id, name: profile.full_name, schoolId: profile.school_id };

  return (
    <ChatThread
      key={conversationId}
      title={header.parent_name}
      subtitle={`re: ${header.student_name}`}
      onBack={() => navigate(listPath)}
      meId={profile.id}
      prefetchAudio
      load={() => fetchMessages(conversationId)}
      sendText={(body) => sendMessage(conversationId, sender, kind, { body })}
      sendVoice={(voice) => sendMessage(conversationId, sender, kind, { voice })}
      subscribe={(onInsert) => subscribeToMessages(conversationId, onInsert)}
      markRead={() => markConversationRead(conversationId, kind)}
    />
  );
}
