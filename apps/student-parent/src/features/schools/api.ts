import { supabase } from "../../lib/supabase";

export interface SchoolInfo {
  name: string;
  logo_url: string | null;
  contact_email: string | null;
  address: string | null;
  phone_1: string | null;
  phone_2: string | null;
  website: string | null;
  motto: string | null;
  year_established: number | null;
  principal_name: string | null;
}

export async function fetchSchoolInfo(schoolId: string): Promise<SchoolInfo | null> {
  const { data, error } = await supabase
    .from("schools")
    .select(
      "name, logo_url, contact_email, address, phone_1, phone_2, website, motto, year_established, principal_name"
    )
    .eq("id", schoolId)
    .single();
  if (error) return null;
  return data as SchoolInfo;
}
