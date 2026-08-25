-- 匿名访客统计修复（在 Supabase SQL Editor 完整运行一次）
-- 修复：匿名访客只显示在线、却不进入今日访问/重复访问/全部访问。
-- 管理员仍只保留在线心跳，不进入任何访客统计和 IP 日志。

create table if not exists public.site_visitors (
  visitor_id text primary key,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  ip_address text,
  ip_location text,
  user_id uuid,
  user_name text,
  visit_count integer not null default 0
);

create table if not exists public.site_presence (
  visitor_id text primary key,
  page_path text,
  last_seen timestamptz not null default now(),
  ip_address text,
  ip_location text,
  user_id uuid,
  user_name text
);

create table if not exists public.site_visitor_logs (
  id bigserial primary key,
  visitor_id text not null,
  ip_address text,
  ip_location text,
  page_path text,
  user_id uuid,
  user_name text,
  visited_at timestamptz not null default now(),
  visit_number integer
);

alter table public.site_visitors
  add column if not exists ip_address text,
  add column if not exists ip_location text,
  add column if not exists user_id uuid,
  add column if not exists user_name text,
  add column if not exists visit_count integer not null default 0;

alter table public.site_presence
  add column if not exists ip_address text,
  add column if not exists ip_location text,
  add column if not exists user_id uuid,
  add column if not exists user_name text;

alter table public.site_visitor_logs
  add column if not exists visitor_id text,
  add column if not exists ip_address text,
  add column if not exists ip_location text,
  add column if not exists page_path text,
  add column if not exists user_id uuid,
  add column if not exists user_name text,
  add column if not exists visited_at timestamptz not null default now(),
  add column if not exists visit_number integer;

update public.site_visitors
set visit_count = greatest(coalesce(visit_count, 0), 1)
where visit_count is null or visit_count < 1;

create index if not exists site_visitor_logs_visitor_time_idx
  on public.site_visitor_logs(visitor_id, visited_at desc);
create index if not exists site_visitor_logs_visited_at_idx
  on public.site_visitor_logs(visited_at desc);

-- One canonical function signature prevents PostgREST from selecting an old
-- overload that only writes presence and never appends a visit log.
drop function if exists public.record_site_presence(text, text);
drop function if exists public.record_site_presence(text, text, text, text, uuid, text);
drop function if exists public.record_site_presence(text, text, text, text, uuid, text, boolean);

create function public.record_site_presence(
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
  v_is_admin boolean := false;
  v_should_log boolean := false;
  v_visit_number integer := 0;
begin
  if p_visitor_id is null or length(trim(p_visitor_id)) < 8 or length(p_visitor_id) > 100 then
    raise exception 'invalid visitor id';
  end if;

  -- Never trust an id sent by the browser. Anonymous visitors stay anonymous.
  p_user_id := auth.uid();
  select exists(
    select 1 from public.profiles p where p.id = p_user_id and coalesce(p.is_admin, false)
  ) into v_is_admin;

  if not v_is_admin and p_increment_count then
    select not exists(
      select 1 from public.site_visitor_logs sl
      where sl.visitor_id = p_visitor_id
        and sl.visited_at > now() - interval '5 minutes'
    ) into v_should_log;
  end if;

  if not v_is_admin then
    insert into public.site_visitors
      (visitor_id, first_seen, last_seen, ip_address, ip_location, user_id, user_name, visit_count)
    values
      (p_visitor_id, now(), now(), p_ip_address, p_ip_location, p_user_id, p_user_name,
       case when v_should_log then 1 else 0 end)
    on conflict (visitor_id) do update set
      last_seen = excluded.last_seen,
      ip_address = coalesce(excluded.ip_address, public.site_visitors.ip_address),
      ip_location = coalesce(excluded.ip_location, public.site_visitors.ip_location),
      user_id = coalesce(excluded.user_id, public.site_visitors.user_id),
      user_name = coalesce(excluded.user_name, public.site_visitors.user_name),
      visit_count = public.site_visitors.visit_count + case when v_should_log then 1 else 0 end
    returning visit_count into v_visit_number;
  end if;

  insert into public.site_presence
    (visitor_id, page_path, last_seen, ip_address, ip_location, user_id, user_name)
  values
    (p_visitor_id, left(coalesce(p_page_path, '/'), 500), now(), p_ip_address, p_ip_location, p_user_id, p_user_name)
  on conflict (visitor_id) do update set
    page_path = excluded.page_path,
    last_seen = excluded.last_seen,
    ip_address = coalesce(excluded.ip_address, public.site_presence.ip_address),
    ip_location = coalesce(excluded.ip_location, public.site_presence.ip_location),
    user_id = coalesce(excluded.user_id, public.site_presence.user_id),
    user_name = coalesce(excluded.user_name, public.site_presence.user_name);

  if v_should_log and not v_is_admin then
    insert into public.site_visitor_logs
      (visitor_id, ip_address, ip_location, page_path, user_id, user_name, visited_at, visit_number)
    values
      (p_visitor_id, p_ip_address, p_ip_location, left(coalesce(p_page_path, '/'), 500),
       p_user_id, p_user_name, now(), greatest(v_visit_number, 1));
  end if;
end;
$$;

create or replace function public.get_site_metrics()
returns table (unique_visitors bigint, online_visitors bigint)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.site_visitors sv
      where not exists (select 1 from public.profiles p where p.id = sv.user_id and coalesce(p.is_admin, false))),
    (select count(*) from public.site_presence sp
      where sp.last_seen >= now() - interval '2 minutes'
        and not exists (select 1 from public.profiles p where p.id = sp.user_id and coalesce(p.is_admin, false)));
$$;

create or replace function public.get_today_site_visitors()
returns bigint
language sql stable security definer
set search_path = public, pg_temp
as $$
  select count(*) from public.site_visitors sv
  where sv.last_seen >= date_trunc('day', now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai'
    and not exists (select 1 from public.profiles p where p.id = sv.user_id and coalesce(p.is_admin, false));
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
  with base as (
    select sl.id, sl.visitor_id, sl.user_name, sl.ip_address, sl.ip_location,
      sl.page_path, sl.visited_at, coalesce(sl.visit_number, sv.visit_count, 1) as visit_number,
      coalesce(sv.visit_count, 1) as total_visits
    from public.site_visitor_logs sl
    left join public.site_visitors sv on sv.visitor_id = sl.visitor_id
    where not exists (select 1 from public.profiles p where p.id = sl.user_id and coalesce(p.is_admin, false))
    union all
    -- Visitors captured before the log table existed remain visible once.
    select null::bigint, sv.visitor_id, sv.user_name, sv.ip_address, sv.ip_location,
      '/'::text, sv.last_seen, greatest(sv.visit_count, 1), greatest(sv.visit_count, 1)
    from public.site_visitors sv
    where not exists (select 1 from public.site_visitor_logs sl where sl.visitor_id = sv.visitor_id)
      and not exists (select 1 from public.profiles p where p.id = sv.user_id and coalesce(p.is_admin, false))
  )
  select id, visitor_id, user_name, ip_address, ip_location, page_path, visited_at, visit_number
  from base
  where p_scope = 'all'
     or (p_scope = 'today' and visited_at >= date_trunc('day', now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai')
     or (p_scope = 'repeat' and total_visits >= 2)
  order by visited_at desc
  limit 500;
$$;

drop function if exists public.get_online_visitors_detail();
create function public.get_online_visitors_detail()
returns table (visitor_id text, user_name text, ip_address text, ip_location text, page_path text, last_seen timestamptz, visit_count integer)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select sp.visitor_id, sp.user_name, sp.ip_address, sp.ip_location, sp.page_path, sp.last_seen,
    greatest(coalesce(sv.visit_count, 1), 1)
  from public.site_presence sp
  left join public.site_visitors sv on sv.visitor_id = sp.visitor_id
  where sp.last_seen >= now() - interval '2 minutes'
    and not exists (select 1 from public.profiles p where p.id = sp.user_id and coalesce(p.is_admin, false))
  order by sp.last_seen desc;
$$;

revoke all on public.site_visitors, public.site_presence, public.site_visitor_logs from anon, authenticated;
revoke all on function public.record_site_presence(text, text, text, text, uuid, text, boolean) from public;
revoke all on function public.get_site_metrics() from public;
revoke all on function public.get_today_site_visitors() from public;
revoke all on function public.get_visitor_visit_logs(text) from public;
revoke all on function public.get_online_visitors_detail() from public;
grant execute on function public.record_site_presence(text, text, text, text, uuid, text, boolean) to anon, authenticated;
grant execute on function public.get_site_metrics(), public.get_today_site_visitors(), public.get_visitor_visit_logs(text), public.get_online_visitors_detail() to authenticated;
