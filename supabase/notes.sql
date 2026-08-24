-- 在 Supabase SQL Editor 中完整运行一次，用于启用管理员私有笔记。
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  is_done boolean not null default false,
  folder text not null default '',
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notes enable row level security;
alter table public.notes add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.notes add column if not exists folder text not null default '';
alter table public.notes add column if not exists is_pinned boolean not null default false;
grant select, insert, update, delete on table public.notes to authenticated;
drop policy if exists "admins manage private notes" on public.notes;
create policy "admins manage private notes" on public.notes for all to authenticated
  using (public.is_blog_admin()) with check (public.is_blog_admin());

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
