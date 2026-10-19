import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getFriendlyErrorMessage } from "@natm/supabase";
import { useAuth } from "../features/auth/AuthContext";
import { supabase } from "../lib/supabase";
import Avatar from "../features/messaging/Avatar";
import ChatThread from "../features/messaging/ChatThread";
import { clearChat, fetchPerson } from "../features/messaging/chatActions";
import type { Person } from "../features/messaging/types";
import { useSchoolType } from "../features/schools/useSchoolType";
import {
  fetchMessages,
  getOrCreateConversation,
  markConversationRead,
  resolveTeacher,
  sendMessage,
  slugToKind,
  teacherLabel,
  subscribeToMessages,
} from "../features/messaging/api";

interface ThreadSetup {
  conversationId: string;
  studentName: string;
  teacherName: string;
  teacher: Person | null;
}

// One direct thread between a parent and one of their child's teachers.
// /parent/messages/:studentId            -> shadow teacher (original route)
// /parent/messages/:studentId/:kind      -> class-teacher | shadow-teacher
export default function ParentChat() {
  const { studentId, kind: kindSlug } = useParams<{ studentId: string; kind?: string }>();
  const { isHomeschool, ready } = useSchoolType();
  // One teacher does both jobs, so whatever link was followed (including the
  // old shadow-teacher route) goes to the class-teacher thread.
  const kind = isHomeschool ? "class_teacher" : slugToKind(kindSlug);
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [setup, setSetup] = useState<ThreadSetup | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId || !profile?.id || !profile.school_id || !ready) return;
    const schoolId = profile.school_id;
    let cancelled = false;

    (async () => {
      try {
        const teacher = await resolveTeacher(studentId, kind);
        if (!teacher) {
          if (!cancelled) setError(`No ${teacherLabel(kind, isHomeschool).toLowerCase()} assigned to this child yet.`);
          return;
        }
        const { data: student } = await supabase.from("students").select("full_name").eq("id", studentId).maybeSingle();
        const person = await fetchPerson(teacher.id).catch(() => null);
        const conversationId = await getOrCreateConversation(studentId, profile.id, kind, teacher.id, schoolId);
        if (cancelled) return;
        setSetup({
          conversationId,
          studentName: student?.full_name ?? "",
          teacherName: teacher.name ?? teacherLabel(kind, isHomeschool),
          teacher: person,
        });
      } catch (err) {
        if (!cancelled) setError(getFriendlyErrorMessage(err, "Failed to load conversation"));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [studentId, kind, profile?.id, profile?.school_id, ready, isHomeschool]);

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
      kind="dm"
      title={setup.teacherName}
      subtitle={`${teacherLabel(kind, isHomeschool)} · re: ${setup.studentName}`}
      onBack={() => navigate("/parent/messages")}
      meId={profile.id}
      prefetchAudio
      headerAvatar={<Avatar name={setup.teacherName} role={kind} photoPath={setup.teacher?.photoPath} />}
      people={setup.teacher ? { [setup.teacher.id]: setup.teacher } : undefined}
      load={() => fetchMessages(conversationId, profile.id)}
      sendText={(body, replyToId) => sendMessage(conversationId, sender, "parent", { body, replyToId })}
      sendVoice={(voice, replyToId) => sendMessage(conversationId, sender, "parent", { voice, replyToId })}
      subscribe={(onInsert, onChange) => subscribeToMessages(conversationId, onInsert, onChange)}
      markRead={() => markConversationRead(conversationId, "parent")}
      clearChat={() => clearChat("dm", conversationId, profile.id)}
    />
  );
}
