import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { fetchSchoolInfo, type SchoolInfo } from "../features/schools/api";

export default function ParentLayout() {
  const { profile, signOut } = useAuth();
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);

  useEffect(() => {
    if (profile?.school_id) {
      fetchSchoolInfo(profile.school_id).then(setSchoolInfo);
    }
  }, [profile?.school_id]);

  return (
    <div className="min-h-screen flex flex-col bg-abyssal-950">
      <header className="flex items-center justify-between p-4 bg-abyssal-900 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-abyssal-700 overflow-hidden flex items-center justify-center shrink-0">
            {schoolInfo?.logo_url ? (
              <img src={schoolInfo.logo_url} alt="" className="w-full h-full object-contain" />
            ) : (
              <span className="font-display text-abyssal-100 text-[10px]">N</span>
            )}
          </div>
          <div>
            <p className="font-display text-abyssal-100 text-sm">{schoolInfo?.name ?? "NATM"}</p>
            <p className="font-ui text-xs text-abyssal-300">{profile?.full_name}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="text-xs px-3 py-1.5 rounded bg-abyssal-700 text-abyssal-100 font-ui"
        >
          Sign out
        </button>
      </header>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
