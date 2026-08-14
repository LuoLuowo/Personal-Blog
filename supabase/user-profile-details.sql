-- Run this file once in Supabase SQL Editor.
-- Adds optional public profile fields used by avatar detail cards.

alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists personal_tags jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists personal_bio text;
alter table public.profiles add column if not exists mbti text;

alter table public.profiles drop constraint if exists profiles_gender_check;
alter table public.profiles add constraint profiles_gender_check
  check (gender is null or gender in ('男', '女', '保密'));

alter table public.profiles drop constraint if exists profiles_mbti_check;
alter table public.profiles add constraint profiles_mbti_check
  check (mbti is null or mbti in (
    'INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP',
    'ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'
  ));

alter table public.profiles enable row level security;
grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;

drop policy if exists "profiles are readable" on public.profiles;
create policy "profiles are readable" on public.profiles for select using (true);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
