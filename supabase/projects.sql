-- 在 Supabase SQL Editor 中完整运行一次，用于启用“个人项目”。
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  cover_url text,
  project_url text,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;
grant select on table public.projects to anon, authenticated;
grant insert, update, delete on table public.projects to authenticated;
drop policy if exists "projects are publicly readable" on public.projects;
drop policy if exists "admins manage projects" on public.projects;
create policy "projects are publicly readable" on public.projects for select using (true);
create policy "admins manage projects" on public.projects for all to authenticated
  using (public.is_blog_admin()) with check (public.is_blog_admin());
