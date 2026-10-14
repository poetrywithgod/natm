import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { InviteButtons } from "./ForumInvite";

// Sits under a "Parent Model Forum invitation" notification. Shows Accept /
// Decline while the invitation is still open, and what you answered after.
export default function ForumInviteNotice({ groupId, userId }: { groupId: string; userId: string }) {
  const [status, setStatus] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("pta_members")
      .select("status")
      .eq("group_id", groupId)
      .eq("profile_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setStatus(data?.status ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, userId]);

  if (status === undefined) return null;

  if (status === "invited") {
    return (
      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
        <InviteButtons groupId={groupId} onDone={(accepted) => setStatus(accepted ? "active" : "declined")} />
      </div>
    );
  }

  const text =
    status === "active"
      ? "You joined the group"
      : status === "declined"
        ? "You declined"
        : "This invitation is no longer open";
  return <p className="font-ui text-xs mt-2 opacity-70">{text}</p>;
}
