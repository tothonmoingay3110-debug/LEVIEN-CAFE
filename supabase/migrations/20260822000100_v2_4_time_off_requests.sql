-- V2.4: employee time-off requests and schedule conflict protection.
-- Requests are availability records only; no paid-leave or payroll calculations.

do $$
begin
  create type public.time_off_status as enum ('pending', 'approved', 'declined', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.staff_time_off_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text not null default '',
  status public.time_off_status not null default 'pending',
  reviewed_by uuid references public.staff_profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_time_off_dates_valid check (end_date >= start_date),
  constraint staff_time_off_reason_length check (length(reason) <= 500)
);

create index if not exists staff_time_off_staff_dates_idx
on public.staff_time_off_requests (staff_id, start_date, end_date);

create index if not exists staff_time_off_status_dates_idx
on public.staff_time_off_requests (status, start_date, end_date);

drop trigger if exists set_updated_at on public.staff_time_off_requests;
create trigger set_updated_at
before update on public.staff_time_off_requests
for each row execute function public.set_updated_at();

alter table public.staff_time_off_requests enable row level security;
revoke all on public.staff_time_off_requests from anon, authenticated;
grant all on public.staff_time_off_requests to service_role;

comment on table public.staff_time_off_requests is
  'Employee date-range unavailability reviewed by Owner or Manager. Not a paid-leave or payroll record.';
