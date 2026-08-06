-- ============================================================
-- Lessons
-- Class Teacher's uploaded lesson material (PDF, or a pasted
-- Cloudflare Stream video reference), feeding the AI quiz
-- generation pipeline. extracted_text is the text source handed
-- to the quiz generator -- for PDFs it's parsed client-side on
-- upload; for video it's a manual teacher-typed summary for now
-- (no Cloudflare account exists yet to pull real captions from).
-- ============================================================

create type lesson_content_type as enum ('pdf', 'video');

create table lessons (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  title text not null,
  content_type lesson_content_type not null,
  pdf_storage_path text,        -- set when content_type = 'pdf'
  video_id text,                -- set when content_type = 'video' (Cloudflare Stream UID)
  extracted_text text,          -- source text for quiz generation
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_lessons_class_id on lessons(class_id);
create index idx_lessons_subject_id on lessons(subject_id);

alter table lessons enable row level security;
create policy "temp_allow_all_authenticated" on lessons
  for all to authenticated using (true) with check (true);

-- ---------- Storage bucket for lesson PDFs ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-pdfs',
  'lesson-pdfs',
  false,
  20971520, -- 20MB
  array['application/pdf']
)
on conflict (id) do nothing;

create policy "temp_allow_authenticated_read_lesson_pdfs"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'lesson-pdfs');

create policy "temp_allow_authenticated_upload_lesson_pdfs"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'lesson-pdfs');

create policy "temp_allow_authenticated_delete_lesson_pdfs"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'lesson-pdfs');
