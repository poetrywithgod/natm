import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Users } from "lucide-react";
import ForumInviteCard from "./ForumInvite";
import { fetchPtaOverview, type PtaOverview } from "./pta";

// The Parent Model Forum entry shown at the top of a staff member's message list:
// the forum itself once joined, or the invitation while it's waiting for an answer.
export default function PtaCard({ to }: { to: string }) {
  const navigate = useNavigate();
  const [pta, setPta] = useState<PtaOverview | null>(null);

  const load = useCallback(() => {
    return fetchPtaOverview()
      .then((overview) => setPta(overview))
      .catch((err) => console.error("Failed to load Parent Model Forum:", err));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!pta) return null;

  if (pta.my_status === "invited") {
    return (
      <ForumInviteCard
        groupId={pta.group_id}
        name={pta.name}
        invitedBy={pta.invited_by_name}
        onDone={() => void load()}
      />
    );
  }

  return (
    <button
      onClick={() => navigate(to)}
      className="w-full text-left bg-forest-900 rounded-lg p-4 flex items-center gap-3"
    >
      <div className="shrink-0 w-10 h-10 rounded-full bg-forest-800 flex items-center justify-center">
        <Users size={20} className="text-forest-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-forest-100">{pta.name}</p>
        <p className="font-ui text-xs text-forest-300 truncate">
          {pta.last_message_preview ?? `${pta.member_count} members`}
        </p>
      </div>
      {pta.unread_count > 0 && (
        <span className="shrink-0 bg-red-500 text-white text-xs font-ui font-semibold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">
          {pta.unread_count > 9 ? "9+" : pta.unread_count}
        </span>
      )}
      <ChevronRight size={18} className="shrink-0 text-forest-300 ml-1" />
    </button>
  );
}
