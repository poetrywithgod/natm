import { useEffect, useState } from "react";
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

export default function FinanceManagerNotifications() {
  const { session } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = session?.user?.id;
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
  }, [session?.user?.id]);

  if (loading) {
    return <div className="p-6 font-ui text-forest-300 text-sm">Loading notifications...</div>;
  }

  if (items.length === 0) {
    return <div className="p-6 font-ui text-forest-300 text-sm">No notifications yet.</div>;
  }

  return (
    <div className="p-6 flex flex-col gap-2 max-w-2xl">
      <h1 className="font-display text-2xl text-forest-100 mb-2">Notifications</h1>
      {items.map((item) => (
        <div
          key={item.id}
          className={`rounded-lg p-3 border ${
            item.read_at ? "bg-forest-900 border-forest-800" : "bg-forest-800 border-forest-600"
          }`}
        >
          <div className="flex justify-between items-start gap-2">
            <p className="font-ui text-sm text-forest-100">{item.title}</p>
            <span className="font-ui text-xs text-forest-400 whitespace-nowrap">
              {timeAgo(item.created_at)}
            </span>
          </div>
          {item.body && <p className="font-ui text-xs text-forest-300 mt-1">{item.body}</p>}
        </div>
      ))}
    </div>
  );
}
