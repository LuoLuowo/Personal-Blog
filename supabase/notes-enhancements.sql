-- Run once in Supabase SQL Editor after supabase/notes.sql.
-- Adds organization metadata for the administrator's private notes.
alter table public.notes
  add column if not exists folder text not null default '',
  add column if not exists is_pinned boolean not null default false;

create index if not exists notes_user_folder_updated_idx
  on public.notes (user_id, folder, is_pinned desc, updated_at desc);

create table if not exists public.note_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.note_folders enable row level security;
grant select, insert, update, delete on table public.note_folders to authenticated;
drop policy if exists "admins manage private note folders" on public.note_folders;
create policy "admins manage private note folders" on public.note_folders for all to authenticated
  using (public.is_blog_admin()) with check (public.is_blog_admin());
