import { useEffect, useState } from "react";
import { ALL_CLASS_LEVELS, groupClassLevels, type ClassLevel } from "@natm/shared-types";
import { fetchConfiguredLevels, setLevelEnabled } from "../api";

interface Props {
  schoolId: string;
  actorId: string;
}

// Lets a School Admin pick which class levels their school actually
// uses, from the platform's full superset (Creche through SS 3). A
// school using the Nursery 1/2/3 naming enables those and leaves KG
// off; a school using KG does the opposite. Feeds every level dropdown
// elsewhere in the staff app (Classes, eventually Intake/Promotion).
export default function ClassLevelsSettings({ schoolId, actorId }: Props) {
  const [enabled, setEnabled] = useState<Set<ClassLevel> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyLevel, setBusyLevel] = useState<ClassLevel | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const configured = await fetchConfiguredLevels(schoolId);
        // Not configured yet -- default the toggles to "on" for every
        // level so the admin sees the platform default and can narrow
        // it down, rather than starting from an unexplained blank slate.
        const initial = configured ?? ALL_CLASS_LEVELS.map((l) => l.value);
        if (!cancelled) setEnabled(new Set(initial));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load class levels");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  async function handleToggle(level: ClassLevel) {
    if (!enabled) return;
    const wasEnabled = enabled.has(level);
    setBusyLevel(level);
    setError(null);
    try {
      await setLevelEnabled(schoolId, level, !wasEnabled, actorId);
      setEnabled((prev) => {
        const next = new Set(prev);
        if (wasEnabled) next.delete(level);
        else next.add(level);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setBusyLevel(null);
    }
  }

  if (loading || !enabled) return <p className="font-ui text-xs text-forest-300">Loading...</p>;

  return (
    <div className="space-y-4">
      <p className="font-ui text-xs text-forest-300">
        Turn on the levels your school actually uses. This controls what shows up when creating classes.
      </p>
      {error && <p className="font-ui text-xs text-error">{error}</p>}
      {groupClassLevels(ALL_CLASS_LEVELS).map((group) => (
        <div key={group.label} className="space-y-2">
          <p className="font-ui text-[11px] font-semibold uppercase tracking-wide text-forest-500">{group.label}</p>
          <div className="flex flex-wrap gap-2">
            {group.options.map((level) => {
              const on = enabled.has(level.value);
              const busy = busyLevel === level.value;
              return (
                <button
                  key={level.value}
                  onClick={() => handleToggle(level.value)}
                  disabled={busy}
                  className={`font-ui text-xs px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 ${
                    on ? "bg-forest-500 text-forest-950" : "bg-forest-800 text-forest-400"
                  }`}
                >
                  {level.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
