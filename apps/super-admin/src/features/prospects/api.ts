import { supabase } from "../../lib/supabase";
import { createSchool } from "../schools/api";

export type ProspectStage = "new" | "contacted" | "demo_scheduled" | "negotiating" | "won" | "lost";

export const PROSPECT_STAGES: ProspectStage[] = ["new", "contacted", "demo_scheduled", "negotiating", "won", "lost"];

export const STAGE_LABELS: Record<ProspectStage, string> = {
  new: "New",
  contacted: "Contacted",
  demo_scheduled: "Demo Scheduled",
  negotiating: "Negotiating",
  won: "Won",
  lost: "Lost",
};

export interface Prospect {
  id: string;
  school_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  stage: ProspectStage;
  notes: string | null;
  converted_school_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchProspects(): Promise<Prospect[]> {
  const { data, error } = await supabase.from("prospects").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Prospect[];
}

export async function createProspect(input: {
  school_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
}): Promise<void> {
  const { error } = await supabase.from("prospects").insert({
    school_name: input.school_name,
    contact_name: input.contact_name || null,
    contact_email: input.contact_email || null,
    contact_phone: input.contact_phone || null,
  });
  if (error) throw new Error(error.message);
}

export async function updateProspect(
  id: string,
  updates: Partial<Pick<Prospect, "school_name" | "contact_name" | "contact_email" | "contact_phone" | "stage" | "notes">>
): Promise<void> {
  const { error } = await supabase
    .from("prospects")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteProspect(id: string): Promise<void> {
  const { error } = await supabase.from("prospects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Converts a won prospect into a real school, via the same create-school
// Edge Function used from the Schools page -- the prospect's contact
// becomes the first School Admin invite. Records the link both ways:
// stage flips to "won" (if it wasn't already) and converted_school_id is
// set, so a converted prospect is never mistaken for one still in play.
export async function convertProspectToSchool(prospect: Prospect): Promise<{ schoolId: string }> {
  const result = await createSchool(
    prospect.school_name,
    prospect.contact_email ?? "",
    prospect.contact_name ?? "",
    prospect.contact_email ?? ""
  );
  await updateProspect(prospect.id, { stage: "won" });
  const { error } = await supabase
    .from("prospects")
    .update({ converted_school_id: result.school.id, updated_at: new Date().toISOString() })
    .eq("id", prospect.id);
  if (error) throw new Error(error.message);
  return { schoolId: result.school.id };
}
