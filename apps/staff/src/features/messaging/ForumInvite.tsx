import { useState } from "react";
import { Users } from "lucide-react";
import { getFriendlyErrorMessage } from "@natm/supabase";
import { T } from "./chatTheme";
import { respondToForumInvite } from "./pta";

// Accept / decline buttons for a Parent Model Forum invitation.
export function InviteButtons({
  groupId,
  onDone,
}: {
  groupId: string;
  /** Called after the answer is saved (accepted = true / false). */
  onDone: (accepted: boolean) => void;
}) {
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function answer(accept: boolean) {
    setBusy(accept ? "accept" : "decline");
    setError(null);
    try {
      await respondToForumInvite(groupId, accept);
      onDone(accept);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Couldn't save your answer"));
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <button
          onClick={() => void answer(false)}
          disabled={busy !== null}
          className={`flex-1 rounded-md py-2 font-ui text-sm disabled:opacity-60 ${T.outlineBtn}`}
        >
          {busy === "decline" ? "..." : "Decline"}
        </button>
        <button
          onClick={() => void answer(true)}
          disabled={busy !== null}
          className={`flex-1 rounded-md py-2 font-ui text-sm font-semibold disabled:opacity-60 ${T.primaryBtn}`}
        >
          {busy === "accept" ? "Joining..." : "Accept"}
        </button>
      </div>
      {error && <p className="font-ui text-xs text-error mt-2">{error}</p>}
    </div>
  );
}

// The invitation as a card (messages list / the forum page itself).
export default function ForumInviteCard({
  groupId,
  name,
  invitedBy,
  onDone,
}: {
  groupId: string;
  name: string;
  invitedBy: string | null;
  onDone: (accepted: boolean) => void;
}) {
  return (
    <div className={`rounded-lg p-4 space-y-3 ${T.card}`}>
      <div className="flex items-center gap-3">
        <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${T.cardIcon}`}>
          <Users size={20} className={T.accent} />
        </div>
        <div className="min-w-0">
          <p className="font-display">{name}</p>
          <p className={`font-ui text-xs ${T.muted}`}>
            {invitedBy ? `${invitedBy} invited you to join` : "You've been invited to join"}
          </p>
        </div>
      </div>
      <InviteButtons groupId={groupId} onDone={onDone} />
    </div>
  );
}
