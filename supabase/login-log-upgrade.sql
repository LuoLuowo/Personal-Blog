-- ============================================================
-- 登录日志升级：访问次数统计 + 登录日志标题
-- 在 Supabase SQL Editor 中运行一次即可。
-- 1. 给 site_visitors 增加 visit_count 字段，记录该访客累计访问次数
-- 2. record_site_presence 新增 p_increment_count 参数，仅真正访问页面时 +1
-- 3. 三个详情查询函数都返回 visit_count
-- ============================================================

-- 1. 新增访问次数字段（默认1，因为已有记录至少访问过一次）
alter table public.site_visitors
  add column if not exists visit_count integer not null default 1;

-- 2. 删除旧版六参数函数，避免重载冲突
drop function if exists public.record_site_presence(text, text, text, text, uuid, text);

-- 3. 重写 record_site_presence，支持访问次数递增
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
begin
  if p_visitor_id is null or length(trim(p_visitor_id)) < 8 or length(p_visitor_id) > 100 then
    raise exception 'invalid visitor id';
  end if;

  insert into public.site_visitors
    (visitor_id, first_seen, last_seen, ip_address, ip_location, user_id, user_name, visit_count)
  values
    (p_visitor_id, now(), now(), p_ip_address, p_ip_location, p_user_id, p_user_name,
     case when p_increment_count then 1 else 1 end)
  on conflict (visitor_id) do update set
    last_seen = excluded.last_seen,
    -- 只有新值非空时才覆盖，保留首次捕获到的 IP
    ip_address = coalesce(excluded.ip_address, public.site_visitors.ip_address),
    ip_location = coalesce(excluded.ip_location, public.site_visitors.ip_location),
    user_id = coalesce(excluded.user_id, public.site_visitors.user_id),
    user_name = coalesce(excluded.user_name, public.site_visitors.user_name),
    -- 仅在真正新访问时 +1，心跳不递增
    visit_count = public.site_visitors.visit_count + case when p_increment_count then 1 else 0 end;

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
end;
$$;

-- 4. 实时在线访客详情（两分钟内有心跳，且有 IP 记录），关联访问次数
-- 注意：返回类型变了（新增 visit_count），必须先 drop 再 create
drop function if exists public.get_online_visitors_detail();
create or replace function public.get_online_visitors_detail()
returns table (
  visitor_id text,
  user_name text,
  ip_address text,
  ip_location text,
  page_path text,
  last_seen timestamptz,
  visit_count integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    sp.visitor_id,
    sp.user_name,
    sp.ip_address,
    sp.ip_location,
    sp.page_path,
    sp.last_seen,
    coalesce(sv.visit_count, 1) as visit_count
  from public.site_presence sp
  left join public.site_visitors sv on sv.visitor_id = sp.visitor_id
  where sp.last_seen >= now() - interval '2 minutes'
    and sp.ip_address is not null
  order by sp.last_seen desc;
$$;

-- 5. 今日访问访客详情（按中国时间，且有 IP 记录）
drop function if exists public.get_today_visitors_detail();
create or replace function public.get_today_visitors_detail()
returns table (
  visitor_id text,
  user_name text,
  ip_address text,
  ip_location text,
  first_seen timestamptz,
  last_seen timestamptz,
  visit_count integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    sv.visitor_id,
    sv.user_name,
    sv.ip_address,
    sv.ip_location,
    sv.first_seen,
    sv.last_seen,
    coalesce(sv.visit_count, 1) as visit_count
  from public.site_visitors sv
  where sv.last_seen >= date_trunc('day', now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai'
    and sv.ip_address is not null
  order by sv.last_seen desc;
$$;

-- 6. 所有访问过的访客详情（仅含 IP 记录，最多 500 条）
drop function if exists public.get_all_visitors_detail();
create or replace function public.get_all_visitors_detail()
returns table (
  visitor_id text,
  user_name text,
  ip_address text,
  ip_location text,
  first_seen timestamptz,
  last_seen timestamptz,
  visit_count integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    sv.visitor_id,
    sv.user_name,
    sv.ip_address,
    sv.ip_location,
    sv.first_seen,
    sv.last_seen,
    coalesce(sv.visit_count, 1) as visit_count
  from public.site_visitors sv
  where sv.ip_address is not null
  order by sv.last_seen desc
  limit 500;
$$;

-- 7. 权限：记录函数所有人可调用，详情查询仅登录用户可调用
revoke all on function public.record_site_presence(text, text, text, text, uuid, text, boolean) from public;
revoke all on function public.get_online_visitors_detail() from public;
revoke all on function public.get_today_visitors_detail() from public;
revoke all on function public.get_all_visitors_detail() from public;

grant execute on function public.record_site_presence(text, text, text, text, uuid, text, boolean) to anon, authenticated;
grant execute on function public.get_online_visitors_detail() to authenticated;
grant execute on function public.get_today_visitors_detail() to authenticated;
grant execute on function public.get_all_visitors_detail() to authenticated;

-- 8. 重复访客详情（访问次数 >= 2，且有 IP 记录，最多 500 条）
drop function if exists public.get_repeat_visitors_detail();
create or replace function public.get_repeat_visitors_detail()
returns table (
  visitor_id text,
  user_name text,
  ip_address text,
  ip_location text,
  first_seen timestamptz,
  last_seen timestamptz,
  visit_count integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    sv.visitor_id,
    sv.user_name,
    sv.ip_address,
    sv.ip_location,
    sv.first_seen,
    sv.last_seen,
    coalesce(sv.visit_count, 1) as visit_count
  from public.site_visitors sv
  where sv.ip_address is not null
    and coalesce(sv.visit_count, 1) >= 2
  order by sv.visit_count desc, sv.last_seen desc
  limit 500;
$$;

revoke all on function public.get_repeat_visitors_detail() from public;
grant execute on function public.get_repeat_visitors_detail() to authenticated;
