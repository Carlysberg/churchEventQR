-- Youth Dinner tickets. Run this in the Supabase SQL Editor, then run seed.sql on a new project,
-- then set the door key (see README). It is safe to run again on an existing project.
-- First scan of a ticket = CONFIRMED. Second and every later scan = SEATED.

create table if not exists public.tickets (
  ticket_no    text primary key,
  token        text not null unique,
  scans        integer not null default 0,
  confirmed_at timestamptz,
  seated_at    timestamptz,
  last_scan_at timestamptz
);

-- No direct table access. The publishable key is not a secret, so it can only call the functions
-- below. They run as their owner (security definer) and each one requires a ticket token or the door key.
alter table public.tickets enable row level security;
revoke all on public.tickets from public, anon, authenticated;

-- The private schema is not exposed by the Supabase API. Only a hash of the door key is stored.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.door_key (
  id       boolean primary key default true check (id),
  key_hash bytea not null
);
revoke all on private.door_key from public, anon, authenticated;

-- Raises an error on a wrong key, or if no door key has been set.
create or replace function private.require_door_key(p_door_key text)
returns boolean
language plpgsql stable
set search_path = ''
as $$
begin
  if not exists (
    select 1 from private.door_key d
     where d.key_hash = sha256(convert_to(p_door_key, 'UTF8'))
  ) then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  return true;
end;
$$;
revoke all on function private.require_door_key(text) from public, anon, authenticated;

-- Removes the earlier versions of these functions, which had no door key argument.
drop function if exists public.record_scan_by_number(text);
drop function if exists public.reset_ticket(text);
drop function if exists public.list_tickets();

-- A single UPDATE locks the row, so two scans at the same moment cannot both be CONFIRMED.
create or replace function public.record_scan_by_token(p_token text)
returns table (ticket text, status text, scans integer, scanned_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  update public.tickets t
     set scans        = t.scans + 1,
         confirmed_at = coalesce(t.confirmed_at, now()),
         seated_at    = case when t.scans >= 1 then coalesce(t.seated_at, now()) else t.seated_at end,
         last_scan_at = now()
   where t.token = p_token
  returning t.ticket_no,
            case when t.scans = 1 then 'CONFIRMED' else 'SEATED' end,
            t.scans,
            t.last_scan_at;
$$;

create or replace function public.record_scan_by_number(p_ticket text, p_door_key text)
returns table (ticket text, status text, scans integer, scanned_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  update public.tickets t
     set scans        = t.scans + 1,
         confirmed_at = coalesce(t.confirmed_at, now()),
         seated_at    = case when t.scans >= 1 then coalesce(t.seated_at, now()) else t.seated_at end,
         last_scan_at = now()
   where private.require_door_key(p_door_key)
     and t.ticket_no = p_ticket
  returning t.ticket_no,
            case when t.scans = 1 then 'CONFIRMED' else 'SEATED' end,
            t.scans,
            t.last_scan_at;
$$;

create or replace function public.reset_ticket(p_ticket text, p_door_key text)
returns table (ticket text)
language sql
security definer
set search_path = ''
as $$
  update public.tickets t
     set scans = 0, confirmed_at = null, seated_at = null, last_scan_at = null
   where private.require_door_key(p_door_key)
     and t.ticket_no = p_ticket
  returning t.ticket_no;
$$;

-- Tokens are deliberately left out of the door list.
create or replace function public.list_tickets(p_door_key text)
returns table (ticket text, scans integer, confirmed_at timestamptz, seated_at timestamptz)
language sql stable
security definer
set search_path = ''
as $$
  select t.ticket_no, t.scans, t.confirmed_at, t.seated_at
    from public.tickets t
   where private.require_door_key(p_door_key)
     and t.ticket_no <> 'TEST'
   order by t.ticket_no;
$$;

revoke all on function public.record_scan_by_token(text), public.record_scan_by_number(text, text),
                       public.reset_ticket(text, text), public.list_tickets(text)
  from public, anon, authenticated;
grant execute on function public.record_scan_by_token(text), public.record_scan_by_number(text, text),
                          public.reset_ticket(text, text), public.list_tickets(text)
  to anon;
