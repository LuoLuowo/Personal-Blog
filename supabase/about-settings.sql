-- Run once in Supabase SQL Editor. Adds separate content for the About page.
alter table public.profiles add column if not exists about_title text default '关于小罗';
alter table public.profiles add column if not exists about_bio text default '';
alter table public.profiles add column if not exists about_side_bio text default '';
