import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchStudentGuardians, type StudentGuardian } from "../api";
import { getFriendlyErrorMessage } from "@natm/supabase";

interface Props {
  studentId: string;
  // When set, guardian names link to the admin parent profile page.
  adminLinks?: boolean;
}

// Read-only "Parent data" view shared by the admin, class teacher and shadow
// teacher screens. Access is enforced by the get_student_guardians RPC.
// Mount with key={studentId} when the student can change, so state resets.
export default function GuardianPanel({ studentId, adminLinks = false }: Props) {
  const [guardians, setGuardians] = useState<StudentGuardian[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStudentGuardians(studentId)
      .then((g) => {
        if (!cancelled) setGuardians(g);
      })
      .catch((e) => {
        if (!cancelled) setError(getFriendlyErrorMessage(e, "Failed to load parent data"));
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (error) return <p className="text-error font-ui text-sm">{error}</p>;
  if (!guardians) return <p className="font-ui text-sm text-forest-300">Loading...</p>;
  if (guardians.length === 0) {
    return <p className="font-ui text-sm text-forest-300">No parent or guardian is linked to this student yet.</p>;
  }

  return (
    <div className="space-y-3">
      {guardians.map((g) => (
        <div key={g.parent_id} className="bg-forest-900 rounded-lg p-4 space-y-2">
          <div>
            {adminLinks ? (
              <Link to={`/admin/parents/${g.parent_id}`} className="font-display text-lg text-forest-100 hover:underline">
                {g.full_name}
              </Link>
            ) : (
              <p className="font-display text-lg text-forest-100">{g.full_name}</p>
            )}
            {g.relationship && <p className="font-ui text-xs text-forest-300">{g.relationship}</p>}
          </div>
          <Field label="Email" value={g.email} />
          <Field label="Phone" value={g.phone} />
          <Field label="Address" value={g.address} />
        </div>
      ))}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="font-ui text-xs text-forest-300">{label}</p>
      <p className="font-ui text-sm text-forest-100">{value || "Not provided"}</p>
    </div>
  );
}
