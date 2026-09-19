-- ============================================================
-- 设备登录管理：记录每个账号在各设备上的登录会话，支持远程下线
-- 在 Supabase SQL Editor 中运行一次即可。
-- 说明：
--   1. auth_device_sessions 记录登录设备（不含任何 token / 密码）
--   2. 前端每次登录登记设备，心跳时 touch 一次并检查 revoked
--   3. 管理员后台可列出设备、单独下线、一键下线其他设备
-- ============================================================

-- 1. 设备会话表
create table if not exists public.auth_device_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_key text not null,                 -- 浏览器本地生成的设备唯一标识
  device_name text,                         -- 例如：Windows 11 · Chrome
  device_type text,                         -- desktop / mobile / tablet
  os text,
  browser text,
  ip text,
  location text,
  user_agent text,
  logged_in_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  revoked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, device_key)
);

create index if not exists idx_auth_device_sessions_user
  on public.auth_device_sessions (user_id, revoked, last_active_at desc);

comment on table public.auth_device_sessions is '账号登录设备会话（仅设备元信息，不存储 token）';

-- 2. 开启 RLS：默认拒绝，全部读写走下方 security definer 函数
alter table public.auth_device_sessions enable row level security;

-- 3. 登记 / 恢复设备（登录成功后调用）。同一 user_id+device_key 重新登录会重新激活。
create or replace function public.register_device(
  p_device_key text,
  p_device_name text default null,
  p_device_type text default null,
  p_os text default null,
  p_browser text default null,
  p_ip text default null,
  p_location text default null,
  p_user_agent text default null,
  p_reset_login boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if p_device_key is null or length(trim(p_device_key)) < 8 then
    raise exception 'invalid device key';
  end if;


  insert into public.auth_device_sessions
    (user_id, device_key, device_name, device_type, os, browser, ip, location, user_agent,
     logged_in_at, last_active_at, revoked)
  values
    (v_user, p_device_key, p_device_name, p_device_type, p_os, p_browser, p_ip, p_location,
     left(p_user_agent, 500), now(), now(), false)
  on conflict (user_id, device_key) do update set
    device_name = excluded.device_name,
    device_type = excluded.device_type,
    os = excluded.os,
    browser = excluded.browser,
    ip = excluded.ip,
    location = excluded.location,
    user_agent = excluded.user_agent,
    logged_in_at = case when p_reset_login then now() else public.auth_device_sessions.logged_in_at end,
    last_active_at = now(),
    revoked = false
  returning id into v_id;

  return v_id;
end;
$$;

-- 4. 心跳：更新最后活跃时间，并返回当前设备是否已被下线（revoked => 前端立即登出）
create or replace function public.touch_device(p_device_key text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_revoked boolean;
begin
  if v_user is null then
    return false;
  end if;

  update public.auth_device_sessions
    set last_active_at = now()
    where user_id = v_user and device_key = p_device_key;

  select revoked into v_revoked
  from public.auth_device_sessions
  where user_id = v_user and device_key = p_device_key;

  return coalesce(v_revoked, false);
end;
$$;

-- 5. 列出当前账号所有有效（未下线）设备，不返回任何敏感凭据
create or replace function public.list_my_devices()
returns table (
  id uuid,
  device_key text,
  device_name text,
  device_type text,
  os text,
  browser text,
  ip text,
  location text,
  logged_in_at timestamptz,
  last_active_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    s.id,
    s.device_key,
    s.device_name,
    s.device_type,
    s.os,
    s.browser,
    s.ip,
    s.location,
    s.logged_in_at,
    s.last_active_at
  from public.auth_device_sessions s
  where s.user_id = auth.uid()
    and s.revoked = false
  order by s.last_active_at desc;
$$;

-- 6. 单独下线某台设备（仅限本人设备）
create or replace function public.revoke_device(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.auth_device_sessions
    set revoked = true
    where id = p_device_id and user_id = auth.uid();
end;
$$;

-- 7. 一键下线其他所有设备（保留当前设备）
create or replace function public.revoke_other_devices(p_keep_device_key text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.auth_device_sessions
    set revoked = true
    where user_id = auth.uid()
      and revoked = false
      and device_key is distinct from p_keep_device_key;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 8. 权限：仅登录用户可调用
revoke all on function public.register_device(text,text,text,text,text,text,text,text,boolean) from public;
revoke all on function public.touch_device(text) from public;
revoke all on function public.list_my_devices() from public;
revoke all on function public.revoke_device(uuid) from public;
revoke all on function public.revoke_other_devices(text) from public;

grant execute on function public.register_device(text,text,text,text,text,text,text,text,boolean) to authenticated;
grant execute on function public.touch_device(text) to authenticated;
grant execute on function public.list_my_devices() to authenticated;
grant execute on function public.revoke_device(uuid) to authenticated;
grant execute on function public.revoke_other_devices(text) to authenticated;
