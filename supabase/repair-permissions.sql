-- Run this entire file once in Supabase SQL Editor.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter table public.profiles enable row level security;
drop policy if exists "profiles are readable" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "users insert own profile" on public.profiles;
drop policy if exists "users manage own profile" on public.profiles;
create policy "profiles are readable" on public.profiles for select using (true);
create policy "users manage own profile" on public.profiles
  for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);

alter table public.categories enable row level security;
alter table public.tags enable row level security;
drop policy if exists "users manage own categories" on public.categories;
drop policy if exists "users manage own tags" on public.tags;
create policy "users manage own categories" on public.categories
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage own tags" on public.tags
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('xiaoluo-media', 'xiaoluo-media', true)
on conflict (id) do update set public = true;

drop policy if exists "public can read blog media" on storage.objects;
drop policy if exists "users upload own blog media" on storage.objects;
drop policy if exists "users update own blog media" on storage.objects;
drop policy if exists "users delete own blog media" on storage.objects;
create policy "public can read blog media" on storage.objects for select using (bucket_id = 'xiaoluo-media');
create policy "users upload own blog media" on storage.objects
  for insert to authenticated with check (bucket_id = 'xiaoluo-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update own blog media" on storage.objects
  for update to authenticated using (bucket_id = 'xiaoluo-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own blog media" on storage.objects
  for delete to authenticated using (bucket_id = 'xiaoluo-media' and (storage.foldername(name))[1] = auth.uid()::text);
