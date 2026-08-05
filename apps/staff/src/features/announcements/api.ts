import { supabase } from "../../lib/supabase";

export interface Announcement {
  id: string;
  school_id: string;
  title: string;
  body: string;
  target_students: boolean;
  target_parents: boolean;
  target_staff: boolean;
  posted_by: string;
  created_at: string;
  updated_at: string;
  poster?: { full_name: string } | null;
}

export async function fetchAnnouncements(schoolId: string): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("*, poster:profiles(full_name)")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as unknown as Announcement[]) ?? [];
}

export async function fetchStaffAnnouncements(schoolId: string): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("*, poster:profiles(full_name)")
    .eq("school_id", schoolId)
    .eq("target_staff", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as unknown as Announcement[]) ?? [];
}

export async function createAnnouncement(input: {
  school_id: string;
  title: string;
  body: string;
  target_students: boolean;
  target_parents: boolean;
  target_staff: boolean;
  posted_by: string;
}): Promise<void> {
  const { error } = await supabase.from("announcements").insert(input);
  if (error) throw new Error(error.message);
}

export async function updateAnnouncement(
  id: string,
  input: {
    title: string;
    body: string;
    target_students: boolean;
    target_parents: boolean;
    target_staff: boolean;
  }
): Promise<void> {
  const { error } = await supabase
    .from("announcements")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
