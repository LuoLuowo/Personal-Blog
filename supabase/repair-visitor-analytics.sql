-- 访客统计修复（执行一次即可）
-- 作用：今日访客按 visitor_id 去重；历史/重复/IP 搜索不显示管理员；
-- 兼容已经执行过 visitor-log-sequences.sql 的项目。

create or replace function public.get_site_metrics()
returns table (unique_visitors bigint, online_visitors bigint)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.site_visitors sv
      where not exists (
        select 1 from public.profiles p
        where p.id = sv.user_id and p.is_admin = true
      )),
    (select count(*) from public.site_presence sp
      where sp.last_seen >= now() - interval '2 minutes');
$$;

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
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_should_count boolean := false;
  v_visit_number integer := 0;
  v_is_admin boolean := false;
begin
  if p_visitor_id is null or length(trim(p_visitor_id)) < 8 or length(p_visitor_id) > 100 then
    raise exception 'invalid visitor id';
  end if;
  p_user_id := auth.uid();
  select coalesce(is_admin, false) into v_is_admin
  from public.profiles where id = p_user_id;
  if v_is_admin then p_increment_count := false; end if;

  if p_increment_count and not v_is_admin then
    select not exists (
      select 1 from public.site_visitor_logs
      where visitor_id = p_visitor_id and visited_at > now() - interval '5 minutes'
    ) into v_should_count;
  end if;

  if not v_is_admin then
    insert into public.site_visitors
      (visitor_id, first_seen, last_seen, ip_address, ip_location, user_id, user_name, visit_count)
    values
      (p_visitor_id, now(), now(), p_ip_address, p_ip_location, p_user_id, p_user_name,
       case when v_should_count then 1 else 0 end)
    on conflict (visitor_id) do update set
      last_seen = excluded.last_seen,
      ip_address = coalesce(excluded.ip_address, public.site_visitors.ip_address),
      ip_location = coalesce(excluded.ip_location, public.site_visitors.ip_location),
      user_id = coalesce(excluded.user_id, public.site_visitors.user_id),
      user_name = coalesce(excluded.user_name, public.site_visitors.user_name),
      visit_count = public.site_visitors.visit_count + case when v_should_count then 1 else 0 end
    returning visit_count into v_visit_number;
  end if;

  insert into public.site_presence
    (visitor_id, page_path, last_seen, ip_address, ip_location, user_id, user_name)
  values
    (p_visitor_id, left(coalesce(p_page_path, '/'), 500), now(), p_ip_address, p_ip_location, p_user_id, p_user_name)
  on conflict (visitor_id) do update set
    page_path = excluded.page_path, last_seen = excluded.last_seen,
    ip_address = excluded.ip_address, ip_location = excluded.ip_location,
    user_id = excluded.user_id, user_name = excluded.user_name;

  if v_should_count and not v_is_admin then
    insert into public.site_visitor_logs
      (visitor_id, ip_address, ip_location, page_path, user_id, user_name, visited_at, visit_number)
    values
      (p_visitor_id, p_ip_address, p_ip_location, left(coalesce(p_page_path, '/'), 500),
       p_user_id, p_user_name, now(), v_visit_number);
  end if;
end;
$$;

create or replace function public.get_today_site_visitors()
returns bigint
language sql stable security definer
set search_path = public, pg_temp
as $$
  select count(distinct sl.visitor_id)
  from public.site_visitor_logs sl
  where sl.visited_at >= date_trunc('day', now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai'
    and not exists (
      select 1 from public.profiles p
      where p.id = sl.user_id and p.is_admin = true
    );
$$;

drop function if exists public.get_visitor_visit_logs(text);
create function public.get_visitor_visit_logs(p_scope text default 'all')
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
language sql stable security definer
set search_path = public, pg_temp
as $$
  select sl.id, sl.visitor_id, sl.user_name, sl.ip_address, sl.ip_location,
    sl.page_path, sl.visited_at, sl.visit_number
  from public.site_visitor_logs sl
  where sl.ip_address is not null
    and not exists (
      select 1 from public.profiles p
      where p.id = sl.user_id and p.is_admin = true
    )
    and (
      p_scope = 'all'
      or (p_scope = 'today' and sl.visited_at >= date_trunc('day', now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai')
      or (p_scope = 'repeat' and coalesce(sl.visit_number, 1) >= 2)
    )
  order by sl.visited_at desc
  limit 500;
$$;

drop function if exists public.search_visitor_logs(text);
create function public.search_visitor_logs(p_ip text)
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
language sql stable security definer
set search_path = public, pg_temp
as $$
  select sl.id, sl.visitor_id, sl.user_name, sl.ip_address, sl.ip_location,
    sl.page_path, sl.visited_at, sl.visit_number
  from public.site_visitor_logs sl
  where sl.ip_address ilike '%' || p_ip || '%'
    and not exists (
      select 1 from public.profiles p
      where p.id = sl.user_id and p.is_admin = true
    )
  order by sl.visited_at desc
  limit 100;
$$;

revoke all on function public.get_site_metrics() from public;
revoke all on function public.get_today_site_visitors() from public;
revoke all on function public.get_visitor_visit_logs(text) from public;
revoke all on function public.search_visitor_logs(text) from public;
grant execute on function public.get_site_metrics() to authenticated;
grant execute on function public.get_today_site_visitors() to authenticated;
grant execute on function public.get_visitor_visit_logs(text) to authenticated;
grant execute on function public.search_visitor_logs(text) to authenticated;
