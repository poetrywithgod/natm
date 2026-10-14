import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users } from "lucide-react";
import { getFriendlyErrorMessage } from "@natm/supabase";
import { useAuth } from "../auth/AuthContext";
import ChatThread from "./ChatThread";
import ForumInviteCard from "./ForumInvite";
import PtaMembersButton from "./PtaMembersButton";
import { clearChat } from "./chatActions";
import { T } from "./chatTheme";
import {
  fetchPtaMembers,
  fetchPtaMessages,
  fetchPtaOverview,
  leaveForum,
  markPtaRead,
  sendPtaMessage,
  subscribeToPtaMessages,
  type PtaMember,
  type PtaOverview,
} from "./pta";
import type { Person } from "./types";

// The Parent Model Forum screen, the same for every role:
//  - invited  -> the invitation card (accept / decline)
//  - member   -> the group chat
//  - neither  -> a short explanation
// `desktop` puts the thread in a card (school admin / finance manager layouts).
export default function ForumPage({ backTo, desktop }: { backTo: string; desktop?: boolean }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState<PtaOverview | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [members, setMembers] = useState<PtaMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const refreshOverview = useCallback(async () => {
    try {
      setGroup(await fetchPtaOverview());
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Failed to load the Parent Model Forum"));
    } finally {
      setLoaded(true);
    }
  }, []);

  const refreshMembers = useCallback(async (groupId: string) => {
    try {
      setMembers(await fetchPtaMembers(groupId));
    } catch (err) {
      console.error("Failed to load forum members:", err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchPtaOverview()
      .then((overview) => {
        if (!cancelled) setGroup(overview);
      })
      .catch((err) => {
        if (!cancelled) setError(getFriendlyErrorMessage(err, "Failed to load the Parent Model Forum"));
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const groupId = group?.group_id;
  const myStatus = group?.my_status;
  useEffect(() => {
    if (!groupId || myStatus !== "active") return;
    let cancelled = false;
    fetchPtaMembers(groupId)
      .then((list) => {
        if (!cancelled) setMembers(list);
      })
      .catch((err) => console.error("Failed to load forum members:", err));
    return () => {
      cancelled = true;
    };
  }, [groupId, myStatus]);

  const people = useMemo(() => {
    const map: Record<string, Person> = {};
    for (const m of members ?? []) {
      map[m.profile_id] = { id: m.profile_id, name: m.full_name, role: m.role, photoPath: m.photo_url };
    }
    return map;
  }, [members]);

  const back = (
    <button onClick={() => navigate(backTo)} className={`font-ui text-sm mb-3 ${T.link}`}>
      ← Back
    </button>
  );

  if (error) {
    return (
      <div className="p-4">
        {back}
        <p className="font-ui text-sm text-error">{error}</p>
      </div>
    );
  }
  if (!loaded || !profile?.school_id) {
    return <p className={`p-4 font-ui text-sm ${T.muted}`}>Loading...</p>;
  }

  if (!group) {
    return (
      <div className="p-4 max-w-md">
        {back}
        <div className={`rounded-lg p-4 ${T.card}`}>
          <p className="font-display">Parent Model Forum</p>
          <p className={`font-ui text-sm mt-1 ${T.muted}`}>
            You're not part of the forum yet. The school admin can invite you, and you'll get a notification when they do.
          </p>
        </div>
      </div>
    );
  }

  if (group.my_status === "invited") {
    return (
      <div className="p-4 max-w-md">
        {back}
        <ForumInviteCard
          groupId={group.group_id}
          name={group.name}
          invitedBy={group.invited_by_name}
          onDone={(accepted) => {
            if (accepted) void refreshOverview();
            else navigate(backTo);
          }}
        />
      </div>
    );
  }

  const schoolId = profile.school_id;
  const id = group.group_id;

  async function handleLeave() {
    setLeaving(true);
    try {
      await leaveForum(id);
      navigate(backTo);
    } catch (err) {
      setConfirmLeave(false);
      setLeaving(false);
      setError(getFriendlyErrorMessage(err, "Couldn't leave the group"));
    }
  }

  const thread = (
    <>
      <ChatThread
        key={id}
        kind="pta"
        title={group.name}
        subtitle={`${group.member_count} ${group.member_count === 1 ? "member" : "members"}`}
        onBack={() => navigate(backTo)}
        meId={profile.id}
        showSenders
        people={people}
        canModerate={group.is_admin}
        heightClass={desktop ? "h-[calc(100vh-6rem)]" : undefined}
        headerAvatar={
          <span className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${T.cardIcon}`}>
            <Users size={18} className={T.accent} />
          </span>
        }
        headerAction={
          <PtaMembersButton
            group={group}
            members={members}
            onChanged={() => {
              void refreshOverview();
              void refreshMembers(id);
            }}
          />
        }
        menuItems={group.is_admin ? [] : [{ label: "Exit group", danger: true, onClick: () => setConfirmLeave(true) }]}
        load={() => fetchPtaMessages(id, profile.id)}
        sendText={(body, replyToId) => sendPtaMessage(id, schoolId, { body, replyToId })}
        sendVoice={(voice, replyToId) => sendPtaMessage(id, schoolId, { voice, replyToId })}
        subscribe={(onInsert, onChange) => subscribeToPtaMessages(id, onInsert, onChange)}
        markRead={() => markPtaRead(id, profile.id)}
        clearChat={() => clearChat("pta", id, profile.id)}
        onSystemMessage={() => {
          void refreshOverview();
          void refreshMembers(id);
        }}
      />

      {confirmLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !leaving && setConfirmLeave(false)}>
          <div className={`w-full max-w-xs rounded-xl p-4 space-y-3 ${T.sheet}`} onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-base">Exit this group?</p>
            <p className={`font-ui text-xs ${T.muted}`}>
              Everyone will see that you left. You won't see new messages unless the school admin invites you back.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmLeave(false)}
                disabled={leaving}
                className={`flex-1 rounded-md py-2 font-ui text-sm ${T.outlineBtn}`}
              >
                Stay
              </button>
              <button
                onClick={() => void handleLeave()}
                disabled={leaving}
                className="flex-1 rounded-md py-2 font-ui text-sm font-semibold bg-red-600 text-white disabled:opacity-60"
              >
                {leaving ? "Leaving..." : "Exit group"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (!desktop) return thread;
  return (
    <div className="p-4 md:p-6">
      <div className={`max-w-3xl mx-auto rounded-xl overflow-hidden border ${T.sheetBorder}`}>{thread}</div>
    </div>
  );
}
