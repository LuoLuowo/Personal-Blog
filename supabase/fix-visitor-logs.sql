-- ============================================================
-- 修复访客日志不记录、不显示的问题
-- 在 Supabase SQL Editor 中执行
-- ============================================================

-- 1. 修复 record_site_presence 函数：确保IP为null也记录日志
drop function if exists public.record_site_presence(text, text, text, text, uuid, text, boolean);
create or replace function public.record_site_presence(
  p_visitor_id text,
  p_page_path text default '/',
  p_ip_address text default null,
  p_ip_location text default null,
  p_user_id uuid default null,
  p_user_name text default null,
  p_increment_count boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recent_count integer := 0;
  v_should_count boolean := false;
  v_visit_number integer := 1;
begin
  if p_visitor_id is null or length(trim(p_visitor_id)) < 8 or length(trim(p_visitor_id)) > 100 then
    raise exception 'invalid visitor id';
  end if;

  -- 5分钟去重：检查该访客最近5分钟内是否有过访问记录
  if p_increment_count then
    select count(*) into v_recent_count
    from public.site_visitor_logs
    where visitor_id = p_visitor_id
      and visited_at > now() - interval '5 minutes';
    v_should_count := (v_recent_count = 0);
  end if;

  -- 更新/插入访客主表
  insert into public.site_visitors
    (visitor_id, first_seen, last_seen, ip_address, ip_location, user_id, user_name, visit_count)
  values
    (p_visitor_id, now(), now(), p_ip_address, p_ip_location, p_user_id, p_user_name, case when v_should_count then 1 else 0 end)
  on conflict (visitor_id) do update set
    last_seen = excluded.last_seen,
    ip_address = coalesce(excluded.ip_address, public.site_visitors.ip_address),
    ip_location = coalesce(excluded.ip_location, public.site_visitors.ip_location),
    user_id = coalesce(excluded.user_id, public.site_visitors.user_id),
    user_name = coalesce(excluded.user_name, public.site_visitors.user_name),
    visit_count = public.site_visitors.visit_count + case when v_should_count then 1 else 0 end;

  -- 更新在线状态表
  insert into public.site_presence
    (visitor_id, page_path, last_seen, ip_address, ip_location, user_id, user_name)
  values
    (p_visitor_id, left(coalesce(p_page_path, '/'), 500), now(), p_ip_address, p_ip_location, p_user_id, p_user_name)
  on conflict (visitor_id) do update set
    page_path = excluded.page_path,
    last_seen = excluded.last_seen,
    ip_address = excluded.ip_address,
    ip_location = excluded.ip_location,
    user_id = excluded.user_id,
    user_name = excluded.user_name;

  -- 只有真正访问页面且5分钟内无重复时才记录日志
  if v_should_count then
    -- 获取该访客的第几次访问
    select coalesce(max(visit_number), 0) + 1 into v_visit_number
    from public.site_visitor_logs
    where visitor_id = p_visitor_id;

    insert into public.site_visitor_logs
      (visitor_id, ip_address, ip_location, page_path, user_id, user_name, visited_at, visit_number)
    values
      (p_visitor_id, p_ip_address, p_ip_location, left(coalesce(p_page_path, '/'), 500), p_user_id, p_user_name, now(), v_visit_number);

    -- 自动清理：每个访客只保留最近10条
    delete from public.site_visitor_logs
    where visitor_id = p_visitor_id
      and id not in (
        select id from public.site_visitor_logs
        where visitor_id = p_visitor_id
        order by visited_at desc
        limit 10
      );

    -- 自动清理：删除全局10天以前的所有访问记录
    delete from public.site_visitor_logs
    where visited_at < now() - interval '10 days';
  end if;
end;
$$;

-- 2. 修复 get_visitor_visit_logs 函数：不要求IP不为null
drop function if exists public.get_visitor_visit_logs(text);
create or replace function public.get_visitor_visit_logs(p_scope text default 'all')
returns table (
  id bigint,
  visitor_id text,
  user_name text,
  ip_address text,
  ip_location text,
  page_path text,
  visited_at timestamptz,
  visit_number integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    sl.id,
    sl.visitor_id,
    sl.user_name,
    sl.ip_address,
    sl.ip_location,
    sl.page_path,
    sl.visited_at,
    sl.visit_number
  from public.site_visitor_logs sl
  where not exists (select 1 from public.profiles p where p.id = sl.user_id and p.is_admin = true)
    and (
      p_scope = 'all'
      or (p_scope = 'today' and sl.visited_at >= date_trunc('day', now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai')
      or (p_scope = 'repeat' and sl.visit_number >= 2)
    )
  order by sl.visited_at desc
  limit 500;
$$;

-- 3. 修复 search_visitor_logs 函数
drop function if exists public.search_visitor_logs(text);
create or replace function public.search_visitor_logs(p_ip text)
returns table (
  id bigint,
  visitor_id text,
  user_name text,
  ip_address text,
  ip_location text,
  page_path text,
  visited_at timestamptz,
  visit_number integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    sl.id,
    sl.visitor_id,
    sl.user_name,
    sl.ip_address,
    sl.ip_location,
    sl.page_path,
    sl.visited_at,
    sl.visit_number
  from public.site_visitor_logs sl
  where sl.ip_address ilike '%' || p_ip || '%'
    and not exists (select 1 from public.profiles p where p.id = sl.user_id and p.is_admin = true)
  order by sl.visited_at desc
  limit 100;
$$;

-- 4. 权限
grant execute on function public.record_site_presence(text, text, text, text, uuid, text, boolean) to anon, authenticated;
grant execute on function public.get_visitor_visit_logs(text) to authenticated;
grant execute on function public.search_visitor_logs(text) to authenticated;
