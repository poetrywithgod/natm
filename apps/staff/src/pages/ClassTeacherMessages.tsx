import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { getFriendlyErrorMessage } from "@natm/supabase";
import { useAuth } from "../features/auth/AuthContext";
import PtaCard from "../features/messaging/PtaCard";
import {
  fetchClassTeacherContacts,
  getOrCreateConversation,
  type ParentContact,
} from "../features/messaging/api";

export default function ClassTeacherMessages() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<ParentContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    fetchClassTeacherContacts(profile.id)
      .then((rows) => {
        if (!cancelled) setContacts(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(getFriendlyErrorMessage(err, "Failed to load parents"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  async function open(contact: ParentContact) {
    if (!profile?.id || !profile.school_id) return;
    const key = `${contact.student_id}:${contact.parent_id}`;
    setOpening(key);
    setError(null);
    try {
      const conversationId =
        contact.conversation_id ??
        (await getOrCreateConversation(
          contact.student_id,
          contact.parent_id,
          "class_teacher",
          profile.id,
          profile.school_id
        ));
      navigate(`/class-teacher/messages/${conversationId}`);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Failed to open conversation"));
    } finally {
      setOpening(null);
    }
  }

  return (
    <div className="p-4 space-y-3">
      <h1 className="font-display text-xl text-forest-100">Messages</h1>

      <PtaCard to="/class-teacher/pta" />

      {error && <p className="font-ui text-sm text-error">{error}</p>}

      <h2 className="font-ui text-xs uppercase tracking-wide text-forest-300 pt-1">Parents of your class</h2>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-16 rounded-lg bg-forest-900" />
          <div className="h-16 rounded-lg bg-forest-900" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="bg-forest-900 rounded-lg p-6 text-center">
          <MessageCircle className="mx-auto text-forest-300 mb-2" size={24} />
          <p className="font-body text-sm text-forest-300">
            No parents to message yet. Parents appear here once they're linked to a child in your class.
          </p>
        </div>
      ) : (
        contacts.map((c) => {
          const key = `${c.student_id}:${c.parent_id}`;
          return (
            <button
              key={key}
              onClick={() => void open(c)}
              disabled={opening === key}
              className="w-full text-left bg-forest-900 rounded-lg p-4 flex items-center justify-between disabled:opacity-60"
            >
              <div className="min-w-0">
                <p className="font-ui text-sm text-forest-100">{c.parent_name}</p>
                <p className="font-ui text-xs text-forest-300">re: {c.student_name}</p>
                <p className="font-ui text-xs text-forest-300 truncate mt-0.5">
                  {c.last_message_preview ?? "Start a conversation"}
                </p>
              </div>
              {c.unread_count > 0 && (
                <span className="shrink-0 ml-3 bg-red-500 text-white text-xs font-ui font-semibold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">
                  {c.unread_count > 9 ? "9+" : c.unread_count}
                </span>
              )}
            </button>
          );
        })
      )}
    </div>
  );
}
