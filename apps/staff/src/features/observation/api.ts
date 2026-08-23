import { supabase } from "../../lib/supabase";
import { logAuditEvent } from "../audit/api";

export interface Form2ObservationInfo {
  [key: string]: unknown;
}

export interface Form2ProtocolNotes {
  segments?: Record<string, string>;
  snapshot?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Form2DomainData {
  [domainId: string]: Record<string, unknown>;
}

export interface Form2Draft {
  form2Id: string;
  episodeId: string;
  observationInfo: Form2ObservationInfo;
  protocolNotes: Form2ProtocolNotes;
  domains: Form2DomainData;
}

export async function fetchOrCreateForm2Draft(
  episodeId: string,
  schoolId: string,
  studentId: string
): Promise<Form2Draft> {
  const { data: existing, error: existingError } = await supabase
    .from("form2_submissions")
    .select("id, observation_info, protocol_notes, domains")
    .eq("episode_id", episodeId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return {
      form2Id: existing.id,
      episodeId,
      observationInfo: (existing.observation_info ?? {}) as Form2ObservationInfo,
      protocolNotes: (existing.protocol_notes ?? {}) as Form2ProtocolNotes,
      domains: (existing.domains ?? {}) as Form2DomainData,
    };
  }

  const { data: created, error: createError } = await supabase
    .from("form2_submissions")
    .insert({
      episode_id: episodeId,
      school_id: schoolId,
      student_id: studentId,
    })
    .select("id")
    .single();

  if (createError) {
    throw new Error(createError.message);
  }

  const { error: episodeError } = await supabase
    .from("assessment_episodes")
    .update({ status: "form2_draft" })
    .eq("id", episodeId)
    .eq("status", "form1_approved");

  if (episodeError) {
    throw new Error(episodeError.message);
  }

  return {
    form2Id: created.id,
    episodeId,
    observationInfo: {},
    protocolNotes: {},
    domains: {},
  };
}

export async function saveForm2Draft(
  form2Id: string,
  section: "observation_info" | "protocol_notes" | "domains",
  data: Record<string, unknown>
): Promise<void> {
  const { data: current, error: fetchError } = await supabase
    .from("form2_submissions")
    .select(section)
    .eq("id", form2Id)
    .single();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  const currentSection =
    ((current as Record<string, unknown> | null)?.[section] as Record<string, unknown> | null) ?? {};

  const merged = {
    ...currentSection,
    ...data,
  };

  const { error: updateError } = await supabase
    .from("form2_submissions")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- computed
    // property name (section) can't be typed against Supabase's generated
    // Update<form2_submissions> shape, which rejects index signatures.
    .update({
      [section]: merged,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", form2Id);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

export async function submitForm2(
  form2Id: string,
  episodeId: string,
  submittedBy: string,
  schoolId: string
): Promise<void> {
  const now = new Date().toISOString();

  const { error: form2Error } = await supabase
    .from("form2_submissions")
    .update({
      submitted_at: now,
      submitted_by: submittedBy,
    })
    .eq("id", form2Id);

  if (form2Error) {
    throw new Error(form2Error.message);
  }

  const { error: episodeError } = await supabase
    .from("assessment_episodes")
    .update({
      status: "form2_submitted",
      form2_submitted_at: now,
    })
    .eq("id", episodeId);

  if (episodeError) {
    throw new Error(episodeError.message);
  }

  await logAuditEvent({
    school_id: schoolId,
    actor_id: submittedBy,
    action: "iep.form2_submitted",
    entity_type: "assessment_episode",
    entity_id: episodeId,
  });
}
