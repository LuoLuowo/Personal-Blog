-- Run once in Supabase SQL Editor. Adds the administrator-managed music playlist.
create table if not exists public.music_tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  artist text,
  category text,
  file_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.music_tracks to anon, authenticated;
grant insert, update, delete on public.music_tracks to authenticated;
alter table public.music_tracks enable row level security;
drop policy if exists "music tracks are readable" on public.music_tracks;
drop policy if exists "admin manages music tracks" on public.music_tracks;
create policy "music tracks are readable" on public.music_tracks for select using (true);
create policy "admin manages music tracks" on public.music_tracks
  for all to authenticated using (public.is_blog_admin()) with check (public.is_blog_admin());
