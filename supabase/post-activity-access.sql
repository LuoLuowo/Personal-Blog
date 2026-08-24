-- Run once in Supabase SQL Editor to enable article reading permissions by activity level.
alter table public.posts add column if not exists min_activity_score integer not null default 0;
alter table public.posts drop constraint if exists posts_min_activity_score_check;
alter table public.posts add constraint posts_min_activity_score_check check (min_activity_score >= 0);
