import { supabase } from "../../lib/supabase";

export interface PlatformAnnouncement {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

// Read-only from this side -- posting/editing/deleting is Super Admin
// only, done from their own app. School Admin just sees the most recent
// few, newest first.
export async function fetchRecentPlatformAnnouncements(limit = 3): Promise<PlatformAnnouncement[]> {
  const { data, error } = await supabase
    .from("platform_announcements")
    .select("id, title, body, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}
