import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getFriendlyErrorMessage } from "@natm/supabase";
import { useAuth } from "../features/auth/AuthContext";
import { supabase } from "../lib/supabase";
import ChatThread from "../features/messaging/ChatThread";
import {
  TEACHER_KIND_LABEL,
  fetchMessages,
  getOrCreateConversation,
  markConversationRead,
  resolveTeacher,
  sendMessage,
  slugToKind,
  subscribeToMessages,
} from "../features/messaging/api";

interface ThreadSetup {
  conversationId: string;
  studentName: string;
  teacherName: string;
}

// One direct thread between a parent and one of their child's teachers.
// /parent/messages/:studentId            -> shadow teacher (original route)
// /parent/messages/:studentId/:kind      -> class-teacher | shadow-teacher
export default function ParentChat() {
  const { studentId, kind: kindSlug } = useParams<{ studentId: string; kind?: string }>();
  const kind = slugToKind(kindSlug);
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [setup, setSetup] = useState<ThreadSetup | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId || !profile?.id || !profile.school_id) return;
    const schoolId = profile.school_id;
    let cancelled = false;

    (async () => {
      try {
        const teacher = await resolveTeacher(studentId, kind);
        if (!teacher) {
          if (!cancelled) setError(`No ${TEACHER_KIND_LABEL[kind].toLowerCase()} assigned to this child yet.`);
          return;
        }
        const { data: student } = await supabase.from("students").select("full_name").eq("id", studentId).maybeSingle();
        const conversationId = await getOrCreateConversation(studentId, profile.id, kind, teacher.id, schoolId);
        if (cancelled) return;
        setSetup({
          conversationId,
          studentName: student?.full_name ?? "",
          teacherName: teacher.name ?? TEACHER_KIND_LABEL[kind],
        });
      } catch (err) {
        if (!cancelled) setError(getFriendlyErrorMessage(err, "Failed to load conversation"));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [studentId, kind, profile?.id, profile?.school_id]);

  if (error) {
    return (
      <div className="p-4">
        <button onClick={() => navigate("/parent/messages")} className="font-ui text-sm text-abyssal-300 mb-3">
          ← Back
        </button>
        <p className="font-ui text-sm text-error">{error}</p>
      </div>
    );
  }
  if (!setup || !profile?.school_id) {
    return <p className="p-4 font-ui text-sm text-abyssal-300">Loading...</p>;
  }

  const sender = { id: profile.id, name: profile.full_name, schoolId: profile.school_id };
  const { conversationId } = setup;

  return (
    <ChatThread
      key={conversationId}
      title={setup.teacherName}
      subtitle={`${TEACHER_KIND_LABEL[kind]} · re: ${setup.studentName}`}
      onBack={() => navigate("/parent/messages")}
      meId={profile.id}
      prefetchAudio
      load={() => fetchMessages(conversationId)}
      sendText={(body) => sendMessage(conversationId, sender, "parent", { body })}
      sendVoice={(voice) => sendMessage(conversationId, sender, "parent", { voice })}
      subscribe={(onInsert) => subscribeToMessages(conversationId, onInsert)}
      markRead={() => markConversationRead(conversationId, "parent")}
    />
  );
}
