-- 在 Supabase SQL Editor 中完整运行一次，用于启用管理员私有笔记。
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  is_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notes enable row level security;
alter table public.notes add column if not exists attachments jsonb not null default '[]'::jsonb;
grant select, insert, update, delete on table public.notes to authenticated;
drop policy if exists "admins manage private notes" on public.notes;
create policy "admins manage private notes" on public.notes for all to authenticated
  using (public.is_blog_admin()) with check (public.is_blog_admin());
