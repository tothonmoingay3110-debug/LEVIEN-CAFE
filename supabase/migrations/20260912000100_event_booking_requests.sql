create table if not exists public.event_booking_requests (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique default ('EV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  customer_profile_id uuid references public.customer_profiles(id) on delete set null,
  customer_name text not null default '',
  customer_phone text not null default '',
  customer_email text,
  event_name text not null,
  event_type text not null default '',
  event_date date not null,
  start_time time not null,
  end_time time,
  guest_count integer,
  notes text not null default '',
  status text not null default 'new' check (status in ('new','contacted','confirmed','cancelled')),
  admin_note text not null default '',
  handled_by uuid references public.staff_profiles(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_booking_name_length check (length(trim(event_name)) between 2 and 160),
  constraint event_booking_customer_length check (length(customer_name) <= 120 and length(customer_phone) <= 30),
  constraint event_booking_notes_length check (length(notes) <= 2000 and length(admin_note) <= 2000),
  constraint event_booking_guest_count check (guest_count is null or guest_count between 1 and 1000),
  constraint event_booking_time_order check (end_time is null or end_time > start_time)
);
create index if not exists event_booking_status_created_idx on public.event_booking_requests(status, created_at desc);
create index if not exists event_booking_date_idx on public.event_booking_requests(event_date, start_time);
drop trigger if exists set_updated_at on public.event_booking_requests;
create trigger set_updated_at before update on public.event_booking_requests for each row execute function public.set_updated_at();
alter table public.event_booking_requests enable row level security;
revoke all on public.event_booking_requests from anon, authenticated;
grant all on public.event_booking_requests to service_role;
