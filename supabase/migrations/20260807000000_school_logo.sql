alter table schools
  add column if not exists logo_url text;

insert into storage.buckets (id, name, public)
values ('school-logos', 'school-logos', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload school logos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'school-logos');

create policy "Authenticated users can update school logos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'school-logos');

create policy "Anyone can view school logos"
  on storage.objects for select
  to public
  using (bucket_id = 'school-logos');
