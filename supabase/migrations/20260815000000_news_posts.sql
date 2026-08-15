-- ============================================================
-- News posts: School Admin creates/edits/retracts public news
-- entries for the CCSF public marketing site (apps/ccsf-site).
-- Mirrors announcements' shape/RLS pattern. published=false acts
-- as "retract" (soft-hide) without deleting the row/history.
-- ============================================================
create table if not exists news_posts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  title text not null,
  excerpt text not null,
  body text not null,
  image_url text,
  published boolean not null default false,
  posted_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table news_posts enable row level security;

create policy "temp_permissive_news_posts" on news_posts
  for all using (true) with check (true);

create index if not exists idx_news_posts_school on news_posts(school_id, published, created_at desc);

-- ============================================================
-- Storage bucket for news post images. Public (unlike
-- staff-photos) since the public Astro site's build process
-- fetches these images without authentication.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'news-images',
  'news-images',
  true,
  5242880, -- 5MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy "temp_allow_authenticated_upload_news_images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'news-images');

create policy "temp_allow_authenticated_update_news_images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'news-images')
  with check (bucket_id = 'news-images');

create policy "temp_allow_authenticated_delete_news_images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'news-images');
