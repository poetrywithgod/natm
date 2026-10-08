import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFamily } from "../features/family/FamilyContext";
import { useToast } from "../features/toast/ToastContext";

/**
 * Parent <-> Student switch for shared family accounts. Renders nothing for
 * legacy student logins. With more than one linked child it also lets the
 * family pick which child the Student view acts for.
 */
export default function ModeToggle() {
  const { isFamilyAccount, mode, linkedChildren, activeStudentId, setActiveStudentId, switchMode } = useFamily();
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (!isFamilyAccount || !mode) return null;

  const target = mode === "parent" ? "student" : "parent";
  const noChild = target === "student" && !activeStudentId;

  async function handleSwitch() {
    setBusy(true);
    const { error } = await switchMode(target);
    setBusy(false);
    if (error) {
      toast.showToast("Couldn't switch view. Please try again.", "error");
      return;
    }
    navigate(target === "student" ? "/student" : "/parent", { replace: true });
  }

  return (
    <div className="flex items-center gap-2">
      {mode === "parent" && linkedChildren.length > 1 && (
        <select
          value={activeStudentId ?? ""}
          onChange={(e) => setActiveStudentId(e.target.value)}
          className="text-xs px-2 py-1.5 rounded bg-abyssal-700 text-abyssal-100 font-ui max-w-28"
          aria-label="Choose child"
        >
          {linkedChildren.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </select>
      )}
      <button
        onClick={handleSwitch}
        disabled={busy || noChild}
        className="text-xs px-3 py-1.5 rounded bg-lime text-abyssal-950 font-ui disabled:opacity-50"
      >
        {target === "student" ? "Student view" : "Parent view"}
      </button>
    </div>
  );
}
