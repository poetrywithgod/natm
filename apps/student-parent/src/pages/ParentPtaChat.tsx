import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFriendlyErrorMessage } from "@natm/supabase";
import { useAuth } from "../features/auth/AuthContext";
import ChatThread from "../features/messaging/ChatThread";
import PtaMembersButton from "../features/messaging/PtaMembersButton";
import {
  fetchPtaMessages,
  fetchPtaOverview,
  markPtaRead,
  sendPtaMessage,
  subscribeToPtaMessages,
  type PtaOverview,
} from "../features/messaging/pta";

// The school's PTA group: every parent, class/shadow teacher, school admin
// and the finance manager of the school.
export default function ParentPtaChat() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState<PtaOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPtaOverview()
      .then((overview) => {
        if (cancelled) return;
        if (overview) setGroup(overview);
        else setError("The PTA group isn't available for this account.");
      })
      .catch((err) => {
        if (!cancelled) setError(getFriendlyErrorMessage(err, "Failed to load the PTA group"));
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
  if (!group || !profile?.school_id) {
    return <p className="p-4 font-ui text-sm text-abyssal-300">Loading...</p>;
  }

  const groupId = group.group_id;
  const schoolId = profile.school_id;

  return (
    <ChatThread
      key={groupId}
      title={group.name}
      subtitle="Parents, teachers and school staff"
      onBack={() => navigate("/parent/messages")}
      meId={profile.id}
      showSenders
      headerAction={<PtaMembersButton groupId={groupId} count={group.member_count} />}
      load={() => fetchPtaMessages(groupId)}
      sendText={(body) => sendPtaMessage(groupId, schoolId, { body })}
      sendVoice={(voice) => sendPtaMessage(groupId, schoolId, { voice })}
      subscribe={(onInsert) => subscribeToPtaMessages(groupId, onInsert)}
      markRead={() => markPtaRead(groupId, profile.id)}
    />
  );
}
