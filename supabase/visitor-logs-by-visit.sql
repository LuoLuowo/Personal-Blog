-- ============================================================
-- 访问日志按次记录：5分钟内多次访问仅算一次，每个访客只保留最近10条
-- 在 Supabase SQL Editor 中运行一次即可。
-- 1. 新建 site_visitor_logs 表，每次访问插入一条
-- 2. record_site_presence 中5分钟去重、插入日志、清理超过10条
-- 3. 新增按IP搜索日志的函数
-- 4. 一次性清理：清除旧记录，每个访客只留最新一条，visit_count重置为1
-- ============================================================

-- 1. 访问日志表（按次记录）
create table if not exists public.site_visitor_logs (
  id bigserial primary key,
  visitor_id text not null,
  ip_address text,
  ip_location text,
  page_path text,
  user_id uuid,
  user_name text,
  visited_at timestamptz not null default now()
);

create index if not exists site_visitor_logs_ip_idx on public.site_visitor_logs(ip_address);
create index if not exists site_visitor_logs_visitor_idx on public.site_visitor_logs(visitor_id);
create index if not exists site_visitor_logs_visited_at_idx on public.site_visitor_logs(visited_at desc);

alter table public.site_visitor_logs enable row level security;
revoke all on public.site_visitor_logs from anon, authenticated;

-- 2. 重写 record_site_presence，增加5分钟去重、日志插入和自动清理
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
begin
  if p_visitor_id is null or length(trim(p_visitor_id)) < 8 or length(p_visitor_id) > 100 then
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
    insert into public.site_visitor_logs
      (visitor_id, ip_address, ip_location, page_path, user_id, user_name, visited_at)
    values
      (p_visitor_id, p_ip_address, p_ip_location, left(coalesce(p_page_path, '/'), 500), p_user_id, p_user_name, now());

    -- 自动清理：每个访客只保留最近10条
    delete from public.site_visitor_logs
    where visitor_id = p_visitor_id
      and id not in (
        select id from public.site_visitor_logs
        where visitor_id = p_visitor_id
        order by visited_at desc
        limit 10
      );
  end if;
end;
$$;

-- 3. 按IP搜索访问日志（返回该IP所有访客的最近访问记录，最多100条）
drop function if exists public.search_visitor_logs(text);
create or replace function public.search_visitor_logs(p_ip text)
returns table (
  id bigint,
  visitor_id text,
  user_name text,
  ip_address text,
  ip_location text,
  page_path text,
  visited_at timestamptz
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
    sl.visited_at
  from public.site_visitor_logs sl
  where sl.ip_address ilike '%' || p_ip || '%'
  order by sl.visited_at desc
  limit 100;
$$;

-- 4. 一次性清理：清除旧记录，每个访客只留最新一条，visit_count重置为1
-- （只运行这一次，之后不再执行）
delete from public.site_visitor_logs
where id not in (
  select distinct on (visitor_id) id
  from public.site_visitor_logs
  order by visitor_id, visited_at desc
);

update public.site_visitors set visit_count = 1;

-- 5. 权限
revoke all on function public.record_site_presence(text, text, text, text, uuid, text, boolean) from public;
revoke all on function public.search_visitor_logs(text) from public;

grant execute on function public.record_site_presence(text, text, text, text, uuid, text, boolean) to anon, authenticated;
grant execute on function public.search_visitor_logs(text) to authenticated;
