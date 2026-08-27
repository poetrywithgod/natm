import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import {
  fetchNotifications,
  markAllNotificationsRead,
  type NotificationItem,
} from "../features/notifications/api";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ParentNotifications() {
  const { profile } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = profile?.id;
    if (!userId) return;

    let cancelled = false;

    (async () => {
      try {
        const data = await fetchNotifications(userId);
        if (!cancelled) setItems(data);
        await markAllNotificationsRead(userId);
      } catch (err) {
        console.error("Failed to load notifications:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  return (
    <div className="p-4 space-y-4">
      <h1 className="font-display text-xl text-abyssal-100">Notifications</h1>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-16 rounded-lg bg-abyssal-900" />
          <div className="h-16 rounded-lg bg-abyssal-900" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-abyssal-900 rounded-lg p-6 text-center">
          <Bell className="mx-auto text-abyssal-300 mb-2" size={24} />
          <p className="font-body text-sm text-abyssal-300">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-lg p-3 border ${
                item.read_at ? "bg-abyssal-900 border-abyssal-800" : "bg-abyssal-800 border-abyssal-600"
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <p className="font-ui text-sm text-abyssal-100">{item.title}</p>
                <span className="font-ui text-xs text-abyssal-400 whitespace-nowrap">
                  {timeAgo(item.created_at)}
                </span>
              </div>
              {item.body && <p className="font-ui text-xs text-abyssal-300 mt-1">{item.body}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
