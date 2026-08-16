-- V2.1A: individual staff identities and role-based access control.

do $$
begin
  create type public.staff_role as enum ('owner', 'manager', 'supervisor', 'staff');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role public.staff_role not null default 'staff',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_profiles_email_not_blank check (length(trim(email)) > 3),
  constraint staff_profiles_full_name_not_blank check (length(trim(full_name)) > 0)
);

create unique index if not exists staff_profiles_email_unique
on public.staff_profiles (lower(email));

drop trigger if exists set_updated_at on public.staff_profiles;
create trigger set_updated_at
before update on public.staff_profiles
for each row execute function public.set_updated_at();

alter table public.staff_profiles enable row level security;

revoke all on public.staff_profiles from anon, authenticated;
grant select on public.staff_profiles to authenticated;
grant all on public.staff_profiles to service_role;

drop policy if exists "Staff can read their own active profile" on public.staff_profiles;
create policy "Staff can read their own active profile"
on public.staff_profiles for select to authenticated
using ((select auth.uid()) = auth_user_id and active = true);

comment on table public.staff_profiles is
  'Staff identity and application role. Compensation is intentionally stored separately in V2.1B.';
