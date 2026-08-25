-- Student-editable contact info + personal bio/interests, surfaced in
-- Student Settings > Profile and read-only on the Admin Student Profile page.
alter table students
  add column phone text,
  add column address text,
  add column bio text;
