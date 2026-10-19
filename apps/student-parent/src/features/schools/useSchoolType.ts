import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { fetchSchoolInfo, type SchoolType } from "./api";

// A homeschool family is a tenant like any school, but a few things in the
// family apps don't apply to it: there is no PTA forum, no school fees to
// pay (the family only has the platform subscription, which the teacher
// handles), and one teacher plays class teacher and shadow teacher both.
// Pages ask this once; the answer is cached per school for the session.
const cache = new Map<string, SchoolType>();

export function useSchoolType(): { schoolType: SchoolType | null; isHomeschool: boolean; ready: boolean } {
  const { profile } = useAuth();
  const schoolId = profile?.school_id ?? null;
  const [fetched, setFetched] = useState<{ schoolId: string; type: SchoolType } | null>(null);

  useEffect(() => {
    if (!schoolId || cache.has(schoolId)) return;
    let cancelled = false;
    fetchSchoolInfo(schoolId).then((info) => {
      // On a failed lookup fall back to the ordinary school experience.
      const type: SchoolType = info?.school_type ?? "institution";
      if (info) cache.set(schoolId, type);
      if (!cancelled) setFetched({ schoolId, type });
    });
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  const schoolType: SchoolType | null = schoolId
    ? cache.get(schoolId) ?? (fetched?.schoolId === schoolId ? fetched.type : null)
    : null;
  return { schoolType, isHomeschool: schoolType === "homeschool", ready: schoolType !== null };
}
