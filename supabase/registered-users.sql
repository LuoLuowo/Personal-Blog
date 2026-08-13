-- Run this file once in Supabase SQL Editor.
-- Only the blog administrator can call this function.

create or replace function public.list_blog_registered_users()
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  email text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    p.id,
    coalesce(p.display_name, '普通用户') as display_name,
    p.avatar_url,
    u.email,
    u.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.is_admin = false
    and public.is_blog_admin()
  order by u.created_at desc;
$$;

revoke all on function public.list_blog_registered_users() from public;
grant execute on function public.list_blog_registered_users() to authenticated;
