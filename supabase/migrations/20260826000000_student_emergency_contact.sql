-- Emergency contact details, student-editable from Student Settings >
-- Profile, same pattern as phone/address/bio added in
-- 20260825000000_student_profile_fields.sql.
alter table students
  add column emergency_contact_name text,
  add column emergency_contact_phone text,
  add column emergency_contact_phone_alt text;
