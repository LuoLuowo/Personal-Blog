-- Run this file once in Supabase SQL Editor.
-- Step 1: replace YOUR_ADMIN_EMAIL@example.com with the email you use to log in.

alter table public.profiles add column if not exists is_admin boolean not null default false;

-- This helper is used by the security policies below.
create or replace function public.is_blog_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Prevent a normal user from changing their own role through the browser.
create or replace function public.keep_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.is_admin := false;
  elsif auth.uid() is not null and not public.is_blog_admin() then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

drop trigger if exists keep_profile_role on public.profiles;
create trigger keep_profile_role
before insert or update on public.profiles
for each row execute function public.keep_profile_role();

-- Make your existing account the only administrator.
update public.profiles p
set is_admin = true
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('YOUR_ADMIN_EMAIL@example.com');

-- Reset content-write policies. Everyone can read public blog content;
-- only the administrator can create, edit, or delete it.
drop policy if exists "users manage own posts" on public.posts;
drop policy if exists "admin manages posts" on public.posts;
create policy "admin manages posts" on public.posts
  for all to authenticated
  using (public.is_blog_admin())
  with check (public.is_blog_admin());

drop policy if exists "users manage own categories" on public.categories;
drop policy if exists "admin manages categories" on public.categories;
create policy "admin manages categories" on public.categories
  for all to authenticated
  using (public.is_blog_admin())
  with check (public.is_blog_admin());

drop policy if exists "users manage own tags" on public.tags;
drop policy if exists "admin manages tags" on public.tags;
create policy "admin manages tags" on public.tags
  for all to authenticated
  using (public.is_blog_admin())
  with check (public.is_blog_admin());

drop policy if exists "users manage own moments" on public.moments;
drop policy if exists "admin manages moments" on public.moments;
create policy "admin manages moments" on public.moments
  for all to authenticated
  using (public.is_blog_admin())
  with check (public.is_blog_admin());

drop policy if exists "users manage own progress logs" on public.progress_logs;
drop policy if exists "admin manages progress logs" on public.progress_logs;
create policy "admin manages progress logs" on public.progress_logs
  for all to authenticated
  using (public.is_blog_admin())
  with check (public.is_blog_admin());

-- Media uploads are administrator-only too.
drop policy if exists "users upload own blog media" on storage.objects;
drop policy if exists "users update own blog media" on storage.objects;
drop policy if exists "users delete own blog media" on storage.objects;
create policy "admin uploads blog media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'xiaoluo-media' and public.is_blog_admin());
create policy "admin updates blog media" on storage.objects
  for update to authenticated
  using (bucket_id = 'xiaoluo-media' and public.is_blog_admin());
create policy "admin deletes blog media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'xiaoluo-media' and public.is_blog_admin());
