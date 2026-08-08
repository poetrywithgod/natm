alter table schools
  add column if not exists address text,
  add column if not exists phone_1 text,
  add column if not exists phone_2 text,
  add column if not exists website text,
  add column if not exists motto text,
  add column if not exists year_established integer,
  add column if not exists principal_name text;
