-- V2.1B: employee management and manager-only compensation data.

alter table public.staff_profiles
  add column if not exists phone text not null default '',
  add column if not exists must_change_password boolean not null default false;

create table if not exists public.staff_compensation (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null unique references public.staff_profiles(id) on delete cascade,
  hourly_rate numeric(10,2) not null default 0,
  weekly_hours numeric(5,2) not null default 0,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_compensation_hourly_rate_valid check (hourly_rate >= 0 and hourly_rate <= 10000),
  constraint staff_compensation_weekly_hours_valid check (weekly_hours >= 0 and weekly_hours <= 168),
  constraint staff_compensation_currency_valid check (currency ~ '^[A-Z]{3}$')
);

drop trigger if exists set_updated_at on public.staff_compensation;
create trigger set_updated_at
before update on public.staff_compensation
for each row execute function public.set_updated_at();

alter table public.staff_compensation enable row level security;

revoke all on public.staff_compensation from anon, authenticated;
grant all on public.staff_compensation to service_role;

comment on table public.staff_compensation is
  'Manager-only hourly rate and planned weekly hours. Never return through general staff sessions.';
