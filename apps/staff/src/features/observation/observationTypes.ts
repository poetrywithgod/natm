export interface ObservationInfoField {
  key: string;
  label: string;
  type: "text" | "select";
  options?: string[];
}

export const OBSERVATION_INFO_FIELDS: ObservationInfoField[] = [
  { key: "child_name", label: "Child / Learner Name", type: "text" },
  { key: "preferred_name", label: "Preferred Name", type: "text" },
  { key: "dob_age", label: "Date of Birth / Age", type: "text" },
  { key: "learner_id", label: "Learner ID", type: "text" },
  { key: "date_time", label: "Date / Time", type: "text" },
  { key: "observer", label: "Observer", type: "text" },
  {
    key: "observer_role",
    label: "Observer Role",
    type: "select",
    options: ["Parent", "Teacher", "Therapist", "Specialist", "Other"],
  },
  {
    key: "setting",
    label: "Setting",
    type: "select",
    options: ["Classroom", "Home", "Clinic", "Playground", "Online", "Other"],
  },
  {
    key: "observation_type",
    label: "Observation Type",
    type: "select",
    options: ["First contact", "Admission", "Baseline", "Review", "Transition", "Other"],
  },
  {
    key: "primary_communication_mode",
    label: "Primary Communication Mode",
    type: "select",
    options: ["Speech", "AAC", "Sign/gesture", "Mixed", "Other"],
  },
  { key: "current_supports_available", label: "Current Supports Available", type: "text" },
  { key: "languages_used", label: "Languages Used", type: "text" },
];

export interface ObservationSegment {
  key: string;
  label: string;
  prompt: string;
}

export const OBSERVATION_SEGMENTS: ObservationSegment[] = [
  {
    key: "a_arrival_regulation",
    label: "A. Arrival / Regulation",
    prompt: "Observe orientation to environment, arousal level, transition into the setting and use of regulation supports.",
  },
  {
    key: "b_free_choice_interest",
    label: "B. Free Choice / Interest",
    prompt: "Observe spontaneous interests, play/engagement, initiation, persistence and sensory preferences.",
  },
  {
    key: "c_supported_learning_task",
    label: "C. Supported Learning Task",
    prompt: "Offer an age-appropriate, low-pressure task and observe comprehension, attention, processing, motor access and help-seeking.",
  },
  {
    key: "d_communication_interaction",
    label: "D. Communication / Interaction",
    prompt: "Observe receptive and expressive communication, reciprocity, AAC use, social approach and response to others.",
  },
  {
    key: "e_natural_transition",
    label: "E. Natural Transition",
    prompt: "If a transition naturally occurs, observe flexibility, anticipation, regulation and recovery. Do not deliberately provoke distress.",
  },
  {
    key: "f_functional_independence",
    label: "F. Functional Independence",
    prompt: "Observe organization, self-care/access needs, task initiation/closure and environmental navigation as appropriate.",
  },
];

export const FC_OPTIONS = ["0", "1", "2", "3", "4", "N/O"] as const;
export const SI_OPTIONS = ["0", "1", "2", "3", "4", "N/O"] as const;
export const CONFIDENCE_OPTIONS = ["L", "M", "H"] as const;

export interface DomainParameter {
  id: string;
  text: string;
}

export interface FormTwoDomain {
  id: string;
  title: string;
  parameters: DomainParameter[];
}

export interface SnapshotField {
  key: string;
  label: string;
  type: "text" | "textarea" | "radio";
  options?: string[];
}

export const SNAPSHOT_FIELDS: SnapshotField[] = [
  { key: "top_strengths", label: "Top 3 observed strengths", type: "textarea" },
  { key: "top_barriers", label: "Top 3 access barriers", type: "textarea" },
  { key: "most_effective_supports", label: "Most effective supports observed", type: "textarea" },
  { key: "likely_triggers", label: "Likely triggers / overload conditions", type: "textarea" },
  { key: "preferred_communication_mode", label: "Preferred communication / response mode", type: "text" },
  {
    key: "best_learning_entry_point",
    label: "Best learning entry point",
    type: "radio",
    options: ["Visual", "Verbal", "Modelling", "Hands-on", "Movement", "AAC", "Interest-led", "Mixed"],
  },
  { key: "recovery_supports", label: "Recovery / regulation supports", type: "textarea" },
  {
    key: "safety_concerns",
    label: "Immediate safety/access concerns",
    type: "radio",
    options: ["None observed", "Yes — describe below"],
  },
  { key: "safety_concerns_detail", label: "Safety concern details (if any)", type: "textarea" },
];
