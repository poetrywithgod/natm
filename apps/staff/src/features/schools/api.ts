import { supabase } from "../../lib/supabase";
import { logAuditEvent } from "../audit/api";

const LOGO_BUCKET = "school-logos";

function sanitizeFileName(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
  const ext = dotIndex > 0 ? name.slice(dotIndex) : "";
  const safeBase = base.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, "");
  return `${safeBase}${safeExt}`;
}

export type FinancialModel = "fees" | "partnership";

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
  financial_model: FinancialModel;
}

export interface SchoolDetailsInput {
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
      "name, logo_url, contact_email, address, phone_1, phone_2, website, motto, year_established, principal_name, financial_model"
    )
    .eq("id", schoolId)
    .single();
  if (error) return null;
  return data as SchoolInfo;
}

// School Admin's one-time (well, changeable, but not routine) choice of
// which financial model this school runs under. 'fees' is the plain,
// original behaviour. 'partnership' relabels the same Fee Types/
// student_fees flow throughout the Staff and Student/Parent apps as
// quarterly "Child Developmental Support", and additionally lets parents
// pick a Partnership tier (Gold/Silver/Resource Men Support) each time
// they make a contribution.
export async function updateFinancialModel(
  schoolId: string,
  financialModel: FinancialModel,
  actorId: string
): Promise<void> {
  const { error } = await supabase
    .from("schools")
    .update({ financial_model: financialModel })
    .eq("id", schoolId);
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "school.financial_model_updated",
    entity_type: "school",
    entity_id: schoolId,
    details: { financial_model: financialModel },
  });
}

export async function updateSchoolDetails(
  schoolId: string,
  details: SchoolDetailsInput,
  actorId: string
): Promise<void> {
  const { error } = await supabase.from("schools").update(details).eq("id", schoolId);
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "school.details_updated",
    entity_type: "school",
    entity_id: schoolId,
  });
}

export async function updateSchoolName(
  schoolId: string,
  name: string,
  actorId: string
): Promise<void> {
  const { error } = await supabase.from("schools").update({ name }).eq("id", schoolId);
  if (error) throw new Error(error.message);
  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "school.name_updated",
    entity_type: "school",
    entity_id: schoolId,
    details: { name },
  });
}

// The school-logos bucket is public, so we store the public URL directly
// rather than a path -- no signed-URL round trip is needed to display it.
export async function uploadSchoolLogo(
  schoolId: string,
  file: File,
  actorId: string
): Promise<string> {
  const path = `${schoolId}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, {
    upsert: true,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;

  const { error: updateError } = await supabase
    .from("schools")
    .update({ logo_url: publicUrl })
    .eq("id", schoolId);
  if (updateError) throw new Error(updateError.message);

  logAuditEvent({
    school_id: schoolId,
    actor_id: actorId,
    action: "school.logo_updated",
    entity_type: "school",
    entity_id: schoolId,
  });

  return publicUrl;
}
