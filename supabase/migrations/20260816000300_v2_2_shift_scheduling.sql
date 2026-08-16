-- V2.2: employee shift requests and manager-published work schedules.
-- This sprint intentionally does not implement attendance or clock-in records.

do $$
begin
  create type public.shift_request_status as enum ('pending', 'approved', 'declined', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.work_shift_status as enum ('scheduled', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.staff_shift_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  note text not null default '',
  status public.shift_request_status not null default 'pending',
  reviewed_by uuid references public.staff_profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_shift_requests_time_valid check (end_time > start_time),
  constraint staff_shift_requests_note_length check (length(note) <= 500)
);

create table if not exists public.staff_shifts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  position text not null default '',
  note text not null default '',
  status public.work_shift_status not null default 'scheduled',
  source_request_id uuid unique references public.staff_shift_requests(id) on delete set null,
  created_by uuid references public.staff_profiles(id) on delete set null,
  updated_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_shifts_time_valid check (end_time > start_time),
  constraint staff_shifts_position_length check (length(position) <= 80),
  constraint staff_shifts_note_length check (length(note) <= 500)
);

create index if not exists staff_shift_requests_staff_date_idx
on public.staff_shift_requests (staff_id, shift_date);

create index if not exists staff_shift_requests_status_date_idx
on public.staff_shift_requests (status, shift_date);

create index if not exists staff_shifts_staff_date_idx
on public.staff_shifts (staff_id, shift_date);

create index if not exists staff_shifts_status_date_idx
on public.staff_shifts (status, shift_date);

drop trigger if exists set_updated_at on public.staff_shift_requests;
create trigger set_updated_at
before update on public.staff_shift_requests
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.staff_shifts;
create trigger set_updated_at
before update on public.staff_shifts
for each row execute function public.set_updated_at();

alter table public.staff_shift_requests enable row level security;
alter table public.staff_shifts enable row level security;

revoke all on public.staff_shift_requests from anon, authenticated;
revoke all on public.staff_shifts from anon, authenticated;
grant all on public.staff_shift_requests to service_role;
grant all on public.staff_shifts to service_role;

comment on table public.staff_shift_requests is
  'Date-specific preferred shifts submitted by staff and reviewed by Owner or Manager.';
comment on table public.staff_shifts is
  'Published work schedule only. Attendance and clock-in are intentionally out of scope.';
