-- 在 Supabase SQL Editor 中完整运行一次，用于启用管理员常用网站。
create table if not exists public.common_sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  url text not null,
  description text not null default '',
  icon_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.common_sites enable row level security;
grant select, insert, update, delete on table public.common_sites to authenticated;
drop policy if exists "admins manage common sites" on public.common_sites;
drop policy if exists "authenticated users read common sites" on public.common_sites;
create policy "authenticated users read common sites" on public.common_sites
  for select to authenticated using (true);
create policy "admins manage common sites" on public.common_sites for all to authenticated
  using (public.is_blog_admin()) with check (public.is_blog_admin());
