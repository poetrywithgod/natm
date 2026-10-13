import { useState } from "react";
import { Users, X } from "lucide-react";
import { getFriendlyErrorMessage } from "@natm/supabase";
import { fetchPtaMembers, type PtaMember } from "./pta";
import { ROLE_LABELS } from "./types";

const T = {
  button: "text-abyssal-100 hover:bg-abyssal-800",
  sheet: "bg-abyssal-900 text-abyssal-100",
  muted: "text-abyssal-300",
  heading: "text-lime",
  divider: "border-abyssal-800",
};

const ROLE_ORDER = ["school_admin", "finance_manager", "class_teacher", "shadow_teacher", "parent"];

// Who is in the group. Names and roles only -- the list comes from a
// database function precisely so members never see each other's contact details.
export default function PtaMembersButton({ groupId, count }: { groupId: string; count: number }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<PtaMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openPanel() {
    setOpen(true);
    if (members) return;
    try {
      setMembers(await fetchPtaMembers(groupId));
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Couldn't load the member list"));
    }
  }

  const grouped = ROLE_ORDER.map((role) => ({
    role,
    people: (members ?? []).filter((m) => m.role === role),
  })).filter((g) => g.people.length > 0);

  return (
    <>
      <button
        onClick={() => void openPanel()}
        className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 font-ui text-xs ${T.button}`}
        aria-label="Show group members"
      >
        <Users size={16} />
        {count}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
          <div
            className={`w-full sm:max-w-md max-h-[75vh] overflow-y-auto rounded-t-xl sm:rounded-xl p-4 ${T.sheet}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg">Group members</h2>
              <button onClick={() => setOpen(false)} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            {error ? (
              <p className="font-ui text-sm text-error">{error}</p>
            ) : !members ? (
              <p className={`font-ui text-sm ${T.muted}`}>Loading...</p>
            ) : (
              grouped.map((g) => (
                <div key={g.role} className={`mb-3 pb-3 border-b last:border-b-0 ${T.divider}`}>
                  <p className={`font-ui text-xs font-semibold uppercase tracking-wide mb-1 ${T.heading}`}>
                    {ROLE_LABELS[g.role]}s ({g.people.length})
                  </p>
                  {g.people.map((p) => (
                    <p key={p.profile_id} className="font-body text-sm py-0.5">
                      {p.full_name}
                    </p>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
