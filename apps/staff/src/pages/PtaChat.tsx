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

// The school's PTA group, for all four staff roles. Parents, class and
// shadow teachers, school admins and the finance manager are members
// automatically -- there is no list to maintain.
//  - mobile roles (class/shadow teacher): full-screen thread
//  - desktop roles (school admin / finance manager): thread in a card
export default function PtaChat({ backTo, desktop }: { backTo: string; desktop?: boolean }) {
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
        <button onClick={() => navigate(backTo)} className="font-ui text-sm text-forest-300 mb-3">
          ← Back
        </button>
        <p className="font-ui text-sm text-error">{error}</p>
      </div>
    );
  }
  if (!group || !profile?.school_id) {
    return <p className="p-4 font-ui text-sm text-forest-300">Loading...</p>;
  }

  const groupId = group.group_id;
  const schoolId = profile.school_id;

  const thread = (
    <ChatThread
      key={groupId}
      title={group.name}
      subtitle="Parents, teachers and school staff"
      onBack={() => navigate(backTo)}
      meId={profile.id}
      showSenders
      heightClass={desktop ? "h-[calc(100vh-6rem)]" : undefined}
      headerAction={<PtaMembersButton groupId={groupId} count={group.member_count} />}
      load={() => fetchPtaMessages(groupId)}
      sendText={(body) => sendPtaMessage(groupId, schoolId, { body })}
      sendVoice={(voice) => sendPtaMessage(groupId, schoolId, { voice })}
      subscribe={(onInsert) => subscribeToPtaMessages(groupId, onInsert)}
      markRead={() => markPtaRead(groupId, profile.id)}
    />
  );

  if (!desktop) return thread;

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-3xl mx-auto rounded-xl overflow-hidden border border-forest-800">{thread}</div>
    </div>
  );
}
