import { Check, Circle } from "lucide-react";
import { evaluatePassword } from "@natm/shared-types";

/** Live checklist of the password rules, shown under every "new password" field. */
export default function PasswordChecklist({ password }: { password: string }) {
  const rules = evaluatePassword(password);
  return (
    <ul className="space-y-1 font-ui text-xs" aria-label="Password requirements">
      {rules.map((rule) => (
        <li key={rule.id} className={`flex items-center gap-1.5 ${rule.met ? "text-lime-400" : "text-forest-300"}`}>
          {rule.met ? <Check size={12} /> : <Circle size={12} />}
          <span>{rule.label}</span>
        </li>
      ))}
    </ul>
  );
}
