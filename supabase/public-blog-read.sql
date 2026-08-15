-- Run this file once in Supabase SQL Editor.
-- It allows visitors to read the public blog owned by the administrator.
-- It does NOT grant visitors permission to publish, edit, delete, or upload anything.

grant usage on schema public to anon, authenticated;
grant select on table public.profiles, public.posts, public.categories, public.tags,
  public.moments, public.progress_logs to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.moments enable row level security;
alter table public.progress_logs enable row level security;

-- These read policies only expose the public blog. Write permissions remain in admin-permissions.sql.
drop policy if exists "profiles are readable" on public.profiles;
create policy "profiles are readable" on public.profiles
  for select using (true);

drop policy if exists "published posts are readable" on public.posts;
create policy "published posts are readable" on public.posts
  for select using (status = 'published' or public.is_blog_admin());

drop policy if exists "categories are readable" on public.categories;
create policy "categories are readable" on public.categories
  for select using (true);

drop policy if exists "tags are readable" on public.tags;
create policy "tags are readable" on public.tags
  for select using (true);

alter table public.moments add column if not exists is_public boolean not null default false;
drop policy if exists "moments are readable" on public.moments;
create policy "moments are readable" on public.moments
  for select using (
    is_public
    or public.is_blog_admin()
    or (auth.uid() is not null and public.has_activity_access(50))
  );

drop policy if exists "progress logs are readable" on public.progress_logs;
create policy "progress logs are readable" on public.progress_logs
  for select using (true);
