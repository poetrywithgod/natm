-- ============================================================
-- Curriculum PDFs
-- Adds the actual document upload layer on top of the existing
-- global curriculum schema (curriculum_documents/curriculum_weeks/
-- subjects, from 20260731240000_global_curriculum.sql). That schema
-- was built for the AI intake-recommendation pipeline's structured
-- fields (domain_purpose, learning_outcomes, etc.) -- this migration
-- doesn't touch any of that, it just lets Super Admin attach the
-- source PDF itself so it can be viewed/downloaded by School Admin,
-- Class/Shadow Teachers, and Students. Text-extraction into the
-- structured fields is explicitly out of scope for now (deferred
-- until the AI pipeline's Anthropic API credit issue is resolved).
-- ============================================================

alter table curriculum_documents
  add column pdf_url text,
  add column pdf_filename text,
  add column pdf_uploaded_at timestamptz;

insert into storage.buckets (id, name, public)
values ('curriculum-pdfs', 'curriculum-pdfs', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload curriculum PDFs"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'curriculum-pdfs');

create policy "Authenticated users can update curriculum PDFs"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'curriculum-pdfs');

create policy "Authenticated users can delete curriculum PDFs"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'curriculum-pdfs');

create policy "Anyone can view curriculum PDFs"
  on storage.objects for select
  to public
  using (bucket_id = 'curriculum-pdfs');
