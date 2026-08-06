alter table notifications
  add column if not exists pushed_at timestamptz;
