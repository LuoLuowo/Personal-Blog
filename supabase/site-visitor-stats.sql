-- Run this file once in Supabase SQL Editor.
-- Counts one browser as one visitor and treats a heartbeat in the last two minutes as online.

create table if not exists public.site_visitors (
  visitor_id text primary key,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create table if not exists public.site_presence (
  visitor_id text primary key,
  page_path text,
  last_seen timestamptz not null default now()
);

alter table public.site_visitors enable row level security;
alter table public.site_presence enable row level security;

revoke all on public.site_visitors from anon, authenticated;
revoke all on public.site_presence from anon, authenticated;

create or replace function public.record_site_presence(p_visitor_id text, p_page_path text default '/')
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_visitor_id is null or length(trim(p_visitor_id)) < 8 or length(p_visitor_id) > 100 then
    raise exception 'invalid visitor id';
  end if;

  insert into public.site_visitors (visitor_id, first_seen, last_seen)
  values (p_visitor_id, now(), now())
  on conflict (visitor_id) do update set last_seen = excluded.last_seen;

  insert into public.site_presence (visitor_id, page_path, last_seen)
  values (p_visitor_id, left(coalesce(p_page_path, '/'), 500), now())
  on conflict (visitor_id) do update
    set page_path = excluded.page_path, last_seen = excluded.last_seen;
end;
$$;

create or replace function public.get_site_metrics()
returns table (unique_visitors bigint, online_visitors bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.site_visitors),
    (select count(*) from public.site_presence where last_seen >= now() - interval '2 minutes');
$$;

revoke all on function public.record_site_presence(text, text) from public;
revoke all on function public.get_site_metrics() from public;
grant execute on function public.record_site_presence(text, text) to anon, authenticated;
grant execute on function public.get_site_metrics() to authenticated;
