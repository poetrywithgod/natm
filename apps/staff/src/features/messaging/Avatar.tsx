import { useEffect, useState } from "react";
import { getAvatarUrl } from "./avatarUrls";
import { T } from "./chatTheme";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZES = { sm: "w-7 h-7 text-[10px]", md: "w-9 h-9 text-xs", lg: "w-11 h-11 text-sm" } as const;

export default function Avatar({
  name,
  role,
  photoPath,
  size = "md",
}: {
  name: string;
  role: string;
  photoPath?: string | null;
  size?: keyof typeof SIZES;
}) {
  const key = photoPath ? `${role === "parent" ? "p" : "s"}:${photoPath}` : null;
  const [signed, setSigned] = useState<{ key: string; url: string | null } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!photoPath || !key) return;
    let cancelled = false;
    void getAvatarUrl(role, photoPath).then((url) => {
      if (!cancelled) setSigned({ key, url });
    });
    return () => {
      cancelled = true;
    };
  }, [role, photoPath, key]);

  const url = signed && signed.key === key ? signed.url : null;

  return (
    <span
      className={`shrink-0 rounded-full overflow-hidden flex items-center justify-center font-ui font-semibold ${SIZES[size]} ${T.avatar}`}
      title={name}
    >
      {url && failedKey !== key ? (
        <img src={url} alt={name} className="w-full h-full object-cover" onError={() => setFailedKey(key)} />
      ) : (
        initials(name)
      )}
    </span>
  );
}
