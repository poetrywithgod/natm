import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Users } from "lucide-react";
import { fetchPtaOverview, type PtaOverview } from "./pta";

// The PTA group entry shown at the top of a staff member's message list.
export default function PtaCard({ to }: { to: string }) {
  const navigate = useNavigate();
  const [pta, setPta] = useState<PtaOverview | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPtaOverview()
      .then((overview) => {
        if (!cancelled) setPta(overview);
      })
      .catch((err) => console.error("Failed to load PTA group:", err));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!pta) return null;

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
