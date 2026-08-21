-- 仅需执行一次：管理员保留在线状态，但不进入访客、访问次数和 IP 日志统计。
-- 如果已经执行过 visitor-log-sequences.sql 的最新版本，可不重复执行本文件。

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
  v_should_count boolean := false;
  v_visit_number integer := 0;
  v_is_admin boolean := false;
begin
  if p_visitor_id is null or length(trim(p_visitor_id)) < 8 or length(p_visitor_id) > 100 then
    raise exception 'invalid visitor id';
  end if;

  select coalesce(is_admin, false) into v_is_admin
  from public.profiles
  where id = p_user_id;

  if v_is_admin then
    p_increment_count := false;
  end if;

  if p_increment_count and not v_is_admin then
    select not exists (
      select 1 from public.site_visitor_logs
      where visitor_id = p_visitor_id
        and visited_at > now() - interval '5 minutes'
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

  -- 管理员仍然会出现在实时在线列表。
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

  if v_should_count and not v_is_admin then
    insert into public.site_visitor_logs
      (visitor_id, ip_address, ip_location, page_path, user_id, user_name, visited_at, visit_number)
    values
      (p_visitor_id, p_ip_address, p_ip_location, left(coalesce(p_page_path, '/'), 500), p_user_id, p_user_name, now(), v_visit_number);
  end if;
end;
$$;

delete from public.site_visitor_logs
where user_id in (select id from public.profiles where is_admin = true);

delete from public.site_visitors
where user_id in (select id from public.profiles where is_admin = true);

create or replace function public.get_site_metrics()
returns table (unique_visitors bigint, online_visitors bigint)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.site_visitors sv
      where not exists (select 1 from public.profiles p where p.id = sv.user_id and p.is_admin = true)),
    (select count(*) from public.site_presence where last_seen >= now() - interval '2 minutes');
$$;

create or replace function public.get_today_site_visitors()
returns bigint
language sql stable security definer
set search_path = public, pg_temp
as $$
  select count(*) from public.site_visitor_logs sl
  where sl.visited_at >= date_trunc('day', now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai'
    and not exists (select 1 from public.profiles p where p.id = sl.user_id and p.is_admin = true);
$$;
