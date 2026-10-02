-- Amazon Agency Task Manager - Supabase schema
-- Run this entire file in Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  invite_code text unique not null default upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  agency_id uuid references public.agencies(id) on delete set null,
  full_name text,
  email text,
  role text not null default 'va' check (role in ('owner','manager','va')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  account_name text not null,
  client_name text,
  marketplace text default 'Amazon US',
  status text not null default 'Active' check (status in ('Active','Onboarding','Paused','Closed')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  account_id uuid references public.accounts(id) on delete set null,
  title text not null,
  description text,
  assigned_to uuid references public.profiles(id) on delete set null,
  received_by uuid references public.profiles(id) on delete set null,
  source text not null default 'Internal',
  status text not null default 'Not Started' check (status in ('Not Started','In Progress','Waiting on Client','Blocked','Complete')),
  priority text not null default 'Medium' check (priority in ('High','Medium','Low')),
  due_date date,
  recurring boolean not null default false,
  recurrence text,
  created_by uuid references auth.users(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_agency on public.profiles(agency_id);
create index if not exists idx_accounts_agency on public.accounts(agency_id);
create index if not exists idx_tasks_agency on public.tasks(agency_id);
create index if not exists idx_tasks_assigned_to on public.tasks(assigned_to);
create index if not exists idx_tasks_due_date on public.tasks(due_date);

-- Create profile automatically when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Owner creates an agency and joins it.
create or replace function public.create_agency(p_name text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if exists(select 1 from public.profiles where id=auth.uid() and agency_id is not null) then
    raise exception 'User already belongs to an agency';
  end if;
  insert into public.agencies(name, owner_id) values (p_name, auth.uid()) returning id into v_id;
  update public.profiles set agency_id=v_id, role='owner' where id=auth.uid();
  return v_id;
end;
$$;

-- VA/manager joins using the agency invite code.
create or replace function public.join_agency(p_invite_code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select id into v_id from public.agencies where upper(invite_code)=upper(trim(p_invite_code));
  if v_id is null then raise exception 'Invalid invite code'; end if;
  update public.profiles set agency_id=v_id where id=auth.uid() and agency_id is null;
  return v_id;
end;
$$;

-- Helper used by RLS.
create or replace function public.my_agency_id()
returns uuid
language sql
stable
security definer set search_path = public
as $$ select agency_id from public.profiles where id=auth.uid() $$;

alter table public.agencies enable row level security;
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.tasks enable row level security;

-- Agencies: members can read their agency; only owner can update it.
drop policy if exists agencies_select on public.agencies;
create policy agencies_select on public.agencies for select using (id = public.my_agency_id());
drop policy if exists agencies_update_owner on public.agencies;
create policy agencies_update_owner on public.agencies for update using (owner_id=auth.uid()) with check (owner_id=auth.uid());

-- Profiles: members can read teammates. Updates go through restricted RPC functions below.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (agency_id = public.my_agency_id() or id=auth.uid());
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists profiles_update_owner on public.profiles;

-- Prevent browser clients from directly changing protected profile fields such as agency_id or role.
revoke update on table public.profiles from anon, authenticated;

create or replace function public.update_my_profile(p_full_name text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.profiles set full_name=trim(coalesce(p_full_name,'')) where id=auth.uid();
end;
$$;

create or replace function public.owner_update_member(p_member_id uuid, p_full_name text, p_role text, p_active boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
declare v_agency uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select id into v_agency from public.agencies where owner_id=auth.uid();
  if v_agency is null then raise exception 'Owner access required'; end if;
  if p_role not in ('owner','manager','va') then raise exception 'Invalid role'; end if;
  if p_member_id=auth.uid() and p_role<>'owner' then raise exception 'Agency owner cannot demote their own profile'; end if;
  if p_member_id<>auth.uid() and p_role='owner' then raise exception 'Transfer of agency ownership is not supported by this function'; end if;
  update public.profiles
     set full_name=trim(coalesce(p_full_name,'')), role=p_role, active=coalesce(p_active,true)
   where id=p_member_id and agency_id=v_agency;
end;
$$;

revoke all on function public.update_my_profile(text) from public, anon;
revoke all on function public.owner_update_member(uuid,text,text,boolean) from public, anon;
grant execute on function public.update_my_profile(text) to authenticated;
grant execute on function public.owner_update_member(uuid,text,text,boolean) to authenticated;

revoke all on function public.create_agency(text) from public, anon;
revoke all on function public.join_agency(text) from public, anon;
grant execute on function public.create_agency(text) to authenticated;
grant execute on function public.join_agency(text) to authenticated;

-- Accounts: agency members can CRUD.
drop policy if exists accounts_all on public.accounts;
create policy accounts_all on public.accounts for all
using (agency_id = public.my_agency_id())
with check (agency_id = public.my_agency_id());

-- Tasks: agency members can CRUD.
drop policy if exists tasks_all on public.tasks;
create policy tasks_all on public.tasks for all
using (agency_id = public.my_agency_id())
with check (agency_id = public.my_agency_id());

-- Updated timestamp trigger.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;
drop trigger if exists tasks_touch_updated_at on public.tasks;
create trigger tasks_touch_updated_at before update on public.tasks
for each row execute procedure public.touch_updated_at();

-- Optional: when status becomes Complete, stamp completed_at.
create or replace function public.set_completed_at()
returns trigger language plpgsql as $$
begin
  if new.status='Complete' and old.status is distinct from 'Complete' then new.completed_at=now(); end if;
  if new.status<>'Complete' then new.completed_at=null; end if;
  return new;
end; $$;
drop trigger if exists tasks_set_completed_at on public.tasks;
create trigger tasks_set_completed_at before update on public.tasks
for each row execute procedure public.set_completed_at();
