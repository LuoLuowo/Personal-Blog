-- Run once in Supabase SQL Editor.
-- Stores one optional music attachment for each article.
alter table public.posts
  add column if not exists music_attachment jsonb;
