import { useState } from "react";
import { Search, UserPlus, Users, X } from "lucide-react";
import { getFriendlyErrorMessage } from "@natm/supabase";
import Avatar from "./Avatar";
import { T } from "./chatTheme";
import {
  fetchInvitable,
  inviteToForum,
  removeFromForum,
  type InvitableProfile,
  type PtaMember,
  type PtaOverview,
} from "./pta";
import { ROLE_LABELS } from "./types";

const ROLE_ORDER = ["school_admin", "finance_manager", "class_teacher", "shadow_teacher", "parent"];

// The forum's people: who is in it, and (for the school admin) adding,
// inviting and removing. Names, roles and photos only -- the lists come from
// database functions precisely so members never see each other's contact details.
export default function PtaMembersButton({
  group,
  members,
  onChanged,
}: {
  group: PtaOverview;
  members: PtaMember[] | null;
  /** Called after an invite / removal so the page refreshes the list and count. */
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"members" | "add">("members");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<InvitableProfile[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);

  const active = (members ?? []).filter((m) => m.status === "active");
  const pending = (members ?? []).filter((m) => m.status === "invited");
  const grouped = ROLE_ORDER.map((role) => ({ role, people: active.filter((m) => m.role === role) })).filter(
    (g) => g.people.length > 0
  );

  function close() {
    setOpen(false);
    setView("members");
    setError(null);
    setConfirmRemove(null);
    setSelected(new Set());
    setQuery("");
  }

  async function openAdd() {
    setView("add");
    setError(null);
    try {
      setCandidates(await fetchInvitable(group.group_id));
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Couldn't load the list of people"));
    }
  }

  async function sendInvites() {
    if (selected.size === 0 || sending) return;
    setSending(true);
    setError(null);
    try {
      await inviteToForum(group.group_id, [...selected]);
      setSelected(new Set());
      setCandidates(null);
      setView("members");
      onChanged();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Couldn't send the invitations"));
    } finally {
      setSending(false);
    }
  }

  async function remove(member: PtaMember) {
    setBusyId(member.profile_id);
    setError(null);
    try {
      await removeFromForum(group.group_id, member.profile_id);
      setConfirmRemove(null);
      onChanged();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Couldn't remove that person"));
    } finally {
      setBusyId(null);
    }
  }

  const q = query.trim().toLowerCase();
  const shownCandidates = (candidates ?? []).filter(
    (c) => !q || c.full_name.toLowerCase().includes(q) || (c.detail ?? "").toLowerCase().includes(q)
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 font-ui text-xs ${T.headerText} ${T.sheetHover}`}
        aria-label="Show group members"
      >
        <Users size={16} />
        {group.member_count}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={close}>
          <div
            className={`w-full sm:max-w-md max-h-[80vh] flex flex-col rounded-t-xl sm:rounded-xl ${T.sheet}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between p-4 border-b ${T.sheetBorder}`}>
              <div>
                <h2 className="font-display text-lg">{view === "add" ? "Add people" : "Group members"}</h2>
                {view === "members" && (
                  <p className={`font-ui text-xs ${T.muted}`}>{active.length} in {group.name}</p>
                )}
              </div>
              <button onClick={close} aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {error && <p className="font-ui text-sm text-error mb-3">{error}</p>}

              {view === "members" ? (
                <>
                  {group.is_admin && (
                    <button
                      onClick={() => void openAdd()}
                      className={`w-full flex items-center justify-center gap-2 rounded-md py-2.5 mb-4 font-ui text-sm font-semibold ${T.primaryBtn}`}
                    >
                      <UserPlus size={16} /> Add people
                    </button>
                  )}

                  {!members ? (
                    <p className={`font-ui text-sm ${T.muted}`}>Loading...</p>
                  ) : (
                    <>
                      {grouped.map((g) => (
                        <div key={g.role} className={`mb-3 pb-3 border-b last:border-b-0 ${T.sheetBorder}`}>
                          <p className={`font-ui text-xs font-semibold uppercase tracking-wide mb-2 ${T.heading}`}>
                            {ROLE_LABELS[g.role]}s ({g.people.length})
                          </p>
                          {g.people.map((p) => (
                            <div key={p.profile_id} className="flex items-center gap-3 py-1.5">
                              <Avatar name={p.full_name} role={p.role} photoPath={p.photo_url} />
                              <p className="font-body text-sm flex-1 min-w-0 truncate">{p.full_name}</p>
                              {group.is_admin && p.role !== "school_admin" && (
                                <RemoveControl
                                  confirming={confirmRemove === p.profile_id}
                                  busy={busyId === p.profile_id}
                                  label="Remove"
                                  onAsk={() => setConfirmRemove(p.profile_id)}
                                  onCancel={() => setConfirmRemove(null)}
                                  onConfirm={() => void remove(p)}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      ))}

                      {group.is_admin && pending.length > 0 && (
                        <div className="mt-2">
                          <p className={`font-ui text-xs font-semibold uppercase tracking-wide mb-2 ${T.heading}`}>
                            Invitation sent ({pending.length})
                          </p>
                          {pending.map((p) => (
                            <div key={p.profile_id} className="flex items-center gap-3 py-1.5 opacity-80">
                              <Avatar name={p.full_name} role={p.role} photoPath={p.photo_url} />
                              <div className="flex-1 min-w-0">
                                <p className="font-body text-sm truncate">{p.full_name}</p>
                                <p className={`font-ui text-[11px] ${T.muted}`}>
                                  {ROLE_LABELS[p.role]} · waiting for a reply
                                </p>
                              </div>
                              <RemoveControl
                                confirming={confirmRemove === p.profile_id}
                                busy={busyId === p.profile_id}
                                label="Cancel"
                                onAsk={() => setConfirmRemove(p.profile_id)}
                                onCancel={() => setConfirmRemove(null)}
                                onConfirm={() => void remove(p)}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className={`flex items-center gap-2 rounded-md border px-3 py-2 mb-3 ${T.input}`}>
                    <Search size={16} className={T.muted} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search by name, child or class"
                      className="flex-1 bg-transparent font-ui text-sm outline-none"
                    />
                  </div>
                  {!candidates ? (
                    !error && <p className={`font-ui text-sm ${T.muted}`}>Loading...</p>
                  ) : shownCandidates.length === 0 ? (
                    <p className={`font-ui text-sm ${T.muted}`}>
                      {candidates.length === 0 ? "Everyone has already been added or invited." : "No one matches that search."}
                    </p>
                  ) : (
                    shownCandidates.map((c) => {
                      const checked = selected.has(c.profile_id);
                      return (
                        <label
                          key={c.profile_id}
                          className={`flex items-center gap-3 py-2 px-1 rounded-md cursor-pointer ${T.sheetHover}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(c.profile_id)}
                            className="w-4 h-4 shrink-0"
                          />
                          <Avatar name={c.full_name} role={c.role} photoPath={c.photo_url} />
                          <div className="min-w-0 flex-1">
                            <p className="font-body text-sm truncate">{c.full_name}</p>
                            <p className={`font-ui text-[11px] truncate ${T.muted}`}>
                              {ROLE_LABELS[c.role]}
                              {c.detail ? ` · ${c.detail}` : ""}
                            </p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </>
              )}
            </div>

            {view === "add" && (
              <div className={`p-4 border-t flex gap-2 ${T.sheetBorder}`}>
                <button
                  onClick={() => {
                    setView("members");
                    setError(null);
                  }}
                  className={`flex-1 rounded-md py-2 font-ui text-sm ${T.outlineBtn}`}
                >
                  Back
                </button>
                <button
                  onClick={() => void sendInvites()}
                  disabled={selected.size === 0 || sending}
                  className={`flex-1 rounded-md py-2 font-ui text-sm font-semibold disabled:opacity-50 ${T.primaryBtn}`}
                >
                  {sending ? "Sending..." : `Send invitation${selected.size === 1 ? "" : "s"}${selected.size ? ` (${selected.size})` : ""}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function RemoveControl({
  confirming,
  busy,
  label,
  onAsk,
  onCancel,
  onConfirm,
}: {
  confirming: boolean;
  busy: boolean;
  label: string;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!confirming) {
    return (
      <button onClick={onAsk} className="font-ui text-xs text-red-400 px-2 py-1">
        {label}
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <button onClick={onCancel} disabled={busy} className={`font-ui text-xs px-2 py-1 ${T.muted}`}>
        Keep
      </button>
      <button
        onClick={onConfirm}
        disabled={busy}
        className="font-ui text-xs font-semibold px-2 py-1 rounded bg-red-600 text-white disabled:opacity-60"
      >
        {busy ? "..." : "Yes"}
      </button>
    </span>
  );
}
