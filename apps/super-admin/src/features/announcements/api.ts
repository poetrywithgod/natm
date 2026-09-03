import { supabase } from "../../lib/supabase";

export interface PlatformAnnouncement {
  id: string;
  title: string;
  body: string;
  posted_by: string;
  created_at: string;
  updated_at: string;
}

export async function fetchPlatformAnnouncements(): Promise<PlatformAnnouncement[]> {
  const { data, error } = await supabase
    .from("platform_announcements")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function postPlatformAnnouncement(title: string, body: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { error } = await supabase.from("platform_announcements").insert({ title, body, posted_by: user.id });
  if (error) throw new Error(error.message);
}

export async function updatePlatformAnnouncement(id: string, title: string, body: string): Promise<void> {
  const { error } = await supabase
    .from("platform_announcements")
    .update({ title, body, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deletePlatformAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from("platform_announcements").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
