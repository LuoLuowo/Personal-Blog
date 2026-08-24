-- Run once in Supabase SQL Editor to enable nickname login for new registrations.
alter table public.profiles add column if not exists email text unique;

-- Existing accounts created before nickname login can continue using email login.
-- Their email is filled automatically when they next log in by email.
