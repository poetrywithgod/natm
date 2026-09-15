// Every action string actually passed to logAuditEvent (apps/staff) or
// written directly to audit_logs by a Supabase Edge Function
// (supabase/functions/*), with a human-readable description. Shared so
// the staff app's per-school Audit Log and Super Admin's cross-school
// Audit Log describe the same action the same way, and so adding a new
// audited action only means updating one file instead of two.
//
// Anything logged that ISN'T in this map still displays -- see
// describeAuditAction's fallback -- so a newly added action never shows
// up as literally blank, just less polished until it's added here.
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  // Classes
  "class.created": "created a class",
  "class.renamed": "renamed a class",
  "class.deleted": "deleted a class",
  "class.level_changed": "changed a class's level",
  "class.teacher_assigned": "reassigned a class teacher",
  "class.subject_added": "added a subject to a class",
  "class.subject_removed": "removed a subject from a class",

  // Students
  "student.created": "added a student",
  "student.renamed": "renamed a student",
  "student.class_assigned": "reassigned a student's class",
  "student.photo_uploaded": "updated a student's photo",
  "student.promoted": "promoted a student",
  "student.repeated": "marked a student to repeat",
  "student.carryover_added": "added a subject carryover",
  "student.carryover_removed": "removed a subject carryover",

  // Staff accounts
  "staff.invited": "invited a staff member",
  "staff.deactivated": "deactivated a staff member",
  "staff.reactivated": "reactivated a staff member",
  "staff.deleted": "permanently deleted a staff member",
  "staff.impersonated": "signed in as a staff member (impersonation)",

  // Attendance & Timetable
  "attendance.marked": "marked attendance",
  "timetable.period_created": "added a timetable period",
  "timetable.period_updated": "edited a timetable period",
  "timetable.period_deleted": "deleted a timetable period",
  "timetable.entry_saved": "set a timetable slot",
  "timetable.entry_cleared": "cleared a timetable slot",

  // Fees / Billing
  "fee_type.created": "created a fee type",
  "fee_type.archived": "archived a fee type",
  "fee.payment_recorded": "recorded a fee payment",
  "subscription.paid": "paid a subscription invoice",

  // IEP
  "iep.class_assigned": "assigned an IEP class",
  "iep.form1_approved": "approved an IEP Form 1",
  "iep.form2_submitted": "submitted an IEP Form 2",
  "iep.recommendation_approved": "approved an IEP recommendation",
  "iep.recommendation_generated": "generated an IEP recommendation",
  "iep.ai_recommendation_generated": "generated an AI IEP recommendation",
  "iep.shadow_teacher_assigned": "assigned a Shadow Teacher",

  // Daily logs
  "daily_observation.submitted": "submitted a daily observation",
  "daily_observation.saved": "saved a daily observation draft",
  "shadow_daily_record.submitted": "submitted a shadow daily record",
  "shadow_daily_record.saved": "saved a shadow daily record draft",
  "class_activity.logged": "logged a class activity",
  "class_activity.updated": "updated a class activity",
  "class_work.assigned": "assigned class work",

  // Lessons, News & Quizzes
  "lesson.created": "created a lesson",
  "news.created": "posted news",
  "news.updated": "edited news",
  "news.deleted": "deleted news",
  "news.published": "published news",
  "news.retracted": "retracted news",
  "quiz.generated": "generated a quiz",
  "quiz_question.edited": "edited a quiz question",
  "quiz_question.deleted": "deleted a quiz question",

  // Profile
  "profile.name_updated": "updated their name",
  "profile.photo_updated": "updated their photo",

  // School
  "school.created": "created the school",
  "school.name_updated": "updated the school name",
  "school.details_updated": "updated school details",
  "school.logo_updated": "updated the school logo",
  "school.financial_model_updated": "changed the financial model",
  "school.level_enabled": "enabled a class level",
  "school.level_disabled": "disabled a class level",
  "school_admin.invited": "invited a School Admin",

  // Parents
  "parent.created": "added a parent account",

  // Academic calendar
  "quarter.finalized": "finalized a quarter",
};

export interface AuditCategory {
  label: string;
  // An entry matches if the action starts with ANY of these prefixes.
  prefixes: string[];
}

export const AUDIT_CATEGORIES: AuditCategory[] = [
  { label: "All", prefixes: [""] },
  { label: "Staff", prefixes: ["staff."] },
  { label: "Students", prefixes: ["student."] },
  { label: "Classes", prefixes: ["class."] },
  { label: "Attendance", prefixes: ["attendance."] },
  { label: "Timetable", prefixes: ["timetable."] },
  { label: "Fees", prefixes: ["fee_type.", "fee.", "subscription."] },
  { label: "IEP", prefixes: ["iep."] },
  {
    label: "Daily Logs",
    prefixes: ["daily_observation.", "shadow_daily_record.", "class_activity.", "class_work."],
  },
  { label: "Lessons, News & Quizzes", prefixes: ["lesson.", "news.", "quiz"] },
  { label: "Profile", prefixes: ["profile."] },
  { label: "School", prefixes: ["school.", "school_admin."] },
  { label: "Parents", prefixes: ["parent."] },
  { label: "Academic Calendar", prefixes: ["quarter."] },
];

// Falls back to a de-slugged version of the raw action (e.g.
// "some_new.action_type" -> "some new action type") rather than the raw
// string, so a not-yet-mapped action still reads as English.
export function describeAuditAction(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action.replace(/[._]/g, " ");
}
