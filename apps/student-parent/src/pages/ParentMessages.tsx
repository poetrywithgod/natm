import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, MessageCircle, Users } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import {
  KIND_TO_SLUG,
  TEACHER_KIND_LABEL,
  fetchChildThreads,
  type ChildThreads,
  type TeacherThread,
} from "../features/messaging/api";
import ForumInviteCard from "../features/messaging/ForumInvite";
import { fetchPtaOverview, type PtaOverview } from "../features/messaging/pta";

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="shrink-0 ml-3 bg-lime text-abyssal-950 text-xs font-ui font-semibold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">
      {count > 9 ? "9+" : count}
    </span>
  );
}

function ThreadRow({ thread, onOpen }: { thread: TeacherThread; onOpen: () => void }) {
  const assigned = !!thread.teacher_id;
  return (
    <button
      onClick={onOpen}
      disabled={!assigned}
      className="w-full text-left bg-abyssal-900 rounded-lg p-4 flex items-center justify-between disabled:opacity-60"
    >
      <div className="min-w-0">
        <p className="font-ui text-sm text-abyssal-100">
          {TEACHER_KIND_LABEL[thread.kind]}
          {thread.teacher_name && <span className="text-abyssal-300"> · {thread.teacher_name}</span>}
        </p>
        {assigned ? (
          thread.last_message_preview && (
            <p className="font-ui text-xs text-abyssal-300 truncate mt-0.5">{thread.last_message_preview}</p>
          )
        ) : (
          <p className="font-ui text-xs text-abyssal-300">
            No {TEACHER_KIND_LABEL[thread.kind].toLowerCase()} assigned yet
          </p>
        )}
      </div>
      <UnreadBadge count={thread.unread_count} />
    </button>
  );
}

export default function ParentMessages() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [children, setChildren] = useState<ChildThreads[]>([]);
  const [pta, setPta] = useState<PtaOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    Promise.all([
      fetchChildThreads(profile.id),
      fetchPtaOverview().catch((err) => {
        console.error("Failed to load Parent Model Forum:", err);
        return null;
      }),
    ])
      .then(([rows, overview]) => {
        if (cancelled) return;
        setChildren(rows);
        setPta(overview);
      })
      .catch((err) => console.error("Failed to load conversations:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  return (
    <div className="p-4 space-y-4">
      <h1 className="font-display text-xl text-abyssal-100">Messages</h1>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-16 rounded-lg bg-abyssal-900" />
          <div className="h-16 rounded-lg bg-abyssal-900" />
          <div className="h-16 rounded-lg bg-abyssal-900" />
        </div>
      ) : (
        <>
          {pta && pta.my_status === "invited" && (
            <ForumInviteCard
              groupId={pta.group_id}
              name={pta.name}
              invitedBy={pta.invited_by_name}
              onDone={() => {
                fetchPtaOverview()
                  .then(setPta)
                  .catch((err) => console.error("Failed to load Parent Model Forum:", err));
              }}
            />
          )}

          {pta && pta.my_status === "active" && (
            <button
              onClick={() => navigate("/parent/messages/pta")}
              className="w-full text-left bg-abyssal-900 rounded-lg p-4 flex items-center gap-3"
            >
              <div className="shrink-0 w-10 h-10 rounded-full bg-abyssal-800 flex items-center justify-center">
                <Users size={20} className="text-lime" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-abyssal-100">{pta.name}</p>
                <p className="font-ui text-xs text-abyssal-300 truncate">
                  {pta.last_message_preview ?? `${pta.member_count} members`}
                </p>
              </div>
              <UnreadBadge count={pta.unread_count} />
              <ChevronRight size={18} className="shrink-0 text-abyssal-300 ml-1" />
            </button>
          )}

          {children.length === 0 ? (
            <div className="bg-abyssal-900 rounded-lg p-6 text-center">
              <MessageCircle className="mx-auto text-abyssal-300 mb-2" size={24} />
              <p className="font-body text-sm text-abyssal-300">No children linked yet.</p>
            </div>
          ) : (
            children.map((child) => (
              <section key={child.student_id} className="space-y-2">
                <h2 className="font-ui text-xs uppercase tracking-wide text-abyssal-300">{child.student_name}</h2>
                {child.threads.map((thread) => (
                  <ThreadRow
                    key={thread.kind}
                    thread={thread}
                    onOpen={() => navigate(`/parent/messages/${child.student_id}/${KIND_TO_SLUG[thread.kind]}`)}
                  />
                ))}
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}
