import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import { useSchoolType } from "../features/schools/useSchoolType";
import { useToast } from "../features/toast/ToastContext";
import {
  fetchMyRequests,
  createRequest,
  cancelRequest,
  type TeacherRequest,
} from "../features/teacherRequests/api";
import PageSkeleton from "../components/PageSkeleton";
import { getFriendlyErrorMessage } from "@natm/supabase";

const STATUS_COPY: Record<TeacherRequest["status"], string> = {
  open: "Waiting for NATM to match you with a teacher",
  matched: "Matched — your teacher has been assigned",
  cancelled: "Withdrawn",
};

const inputCls =
  "mt-1 w-full rounded-md border border-abyssal-700 bg-abyssal-950 px-3 py-2 font-body text-sm text-abyssal-100";

export default function ParentTeacherRequest() {
  const { profile } = useAuth();
  const { isHomeschool, ready } = useSchoolType();
  const { showToast } = useToast();

  const [requests, setRequests] = useState<TeacherRequest[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [childrenInfo, setChildrenInfo] = useState("");
  const [startDate, setStartDate] = useState("");
  const [schedule, setSchedule] = useState("");
  const [location, setLocation] = useState("");
  const [specialNeeds, setSpecialNeeds] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMyRequests()
      .then((r) => {
        if (!cancelled) setRequests(r);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(getFriendlyErrorMessage(e, "Failed to load your requests"));
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (!ready) return <PageSkeleton />;
  if (!isHomeschool) return <Navigate to="/parent" replace />;

  const hasOpen = (requests ?? []).some((r) => r.status === "open");

  async function handleSubmit() {
    if (!profile?.school_id || !profile.id) return;
    if (!childrenInfo.trim()) {
      setError("Tell us about your children (how many, and their ages or levels).");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createRequest(profile.school_id, profile.id, {
        children_info: childrenInfo,
        preferred_start_date: startDate,
        schedule,
        location,
        special_needs: specialNeeds,
        notes,
      });
      showToast("Request sent. NATM will be in touch.");
      setChildrenInfo("");
      setStartDate("");
      setSchedule("");
      setLocation("");
      setSpecialNeeds("");
      setNotes("");
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(getFriendlyErrorMessage(e, "Failed to send your request"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(id: string) {
    try {
      await cancelRequest(id);
      showToast("Request withdrawn.");
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(getFriendlyErrorMessage(e, "Failed to withdraw the request"));
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <GraduationCap className="text-abyssal-300" size={20} />
        <h1 className="font-display text-xl text-abyssal-100">Request a teacher</h1>
      </div>
      <p className="font-body text-sm text-abyssal-300">
        NATM matches homeschool families with trained teachers. Tell us what you need and we will find the right fit.
      </p>

      {loadError && <p className="font-ui text-sm text-error">{loadError}</p>}

      {(requests ?? []).length > 0 && (
        <div className="space-y-2">
          {(requests ?? []).map((r) => (
            <div key={r.id} data-testid="my-request" className="bg-abyssal-900 rounded-lg p-4 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <p className="font-ui text-sm text-abyssal-100">{STATUS_COPY[r.status]}</p>
                {r.status === "open" && (
                  <button
                    onClick={() => handleCancel(r.id)}
                    className="font-ui text-xs text-error hover:underline"
                  >
                    Withdraw
                  </button>
                )}
              </div>
              <p className="font-body text-xs text-abyssal-300">
                Sent {new Date(r.created_at).toLocaleDateString()} · {r.children_info}
              </p>
            </div>
          ))}
        </div>
      )}

      {!hasOpen && requests !== null && (
        <div className="bg-abyssal-900 rounded-lg p-4 space-y-3">
          <div>
            <label htmlFor="req-children" className="font-ui text-xs text-abyssal-300">
              Your children (how many, ages or levels)
            </label>
            <textarea
              id="req-children"
              rows={2}
              value={childrenInfo}
              onChange={(e) => setChildrenInfo(e.target.value)}
              className={inputCls}
              placeholder="e.g. Two children: 6 (Primary 1) and 9 (Primary 4)"
            />
          </div>
          <div>
            <label htmlFor="req-start" className="font-ui text-xs text-abyssal-300">Preferred start date</label>
            <input id="req-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="req-schedule" className="font-ui text-xs text-abyssal-300">Days and hours you want teaching</label>
            <input id="req-schedule" value={schedule} onChange={(e) => setSchedule(e.target.value)} className={inputCls} placeholder="e.g. Mon–Fri, 9am–1pm" />
          </div>
          <div>
            <label htmlFor="req-location" className="font-ui text-xs text-abyssal-300">Where teaching will happen (area)</label>
            <input id="req-location" value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} placeholder="e.g. Rumuokoro, Port Harcourt, or online" />
          </div>
          <div>
            <label htmlFor="req-needs" className="font-ui text-xs text-abyssal-300">Support needs the teacher should know about (optional)</label>
            <textarea id="req-needs" rows={2} value={specialNeeds} onChange={(e) => setSpecialNeeds(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="req-notes" className="font-ui text-xs text-abyssal-300">Anything else (optional)</label>
            <textarea id="req-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
          </div>
          {error && <p className="font-ui text-xs text-error">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 rounded bg-abyssal-500 text-abyssal-950 font-ui text-sm font-semibold disabled:opacity-50"
          >
            {submitting ? "Sending..." : "Send request"}
          </button>
        </div>
      )}
      {hasOpen && error && <p className="font-ui text-xs text-error">{error}</p>}
    </div>
  );
}
