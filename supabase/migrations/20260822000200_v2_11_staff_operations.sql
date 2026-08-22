-- V2.6-V2.11: staff notifications, shift coverage requests and audit history.
-- Attendance, clock-in and payroll records remain intentionally out of scope.

do $$
begin
  create type public.shift_swap_status as enum ('pending', 'approved', 'declined', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.staff_notifications (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  notification_type text not null default 'system',
  title text not null,
  message text not null default '',
  link text not null default '/admin',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint staff_notifications_type_valid
    check (notification_type in ('schedule', 'swap', 'time_off', 'system')),
  constraint staff_notifications_title_length check (length(title) between 1 and 120),
  constraint staff_notifications_message_length check (length(message) <= 500),
  constraint staff_notifications_link_length check (length(link) <= 200)
);

create table if not exists public.staff_shift_swap_requests (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.staff_shifts(id) on delete cascade,
  requester_id uuid not null references public.staff_profiles(id) on delete cascade,
  offered_to uuid not null references public.staff_profiles(id) on delete cascade,
  note text not null default '',
  status public.shift_swap_status not null default 'pending',
  reviewed_by uuid references public.staff_profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_shift_swap_people_different check (requester_id <> offered_to),
  constraint staff_shift_swap_note_length check (length(note) <= 500)
);

create table if not exists public.staff_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.staff_profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint staff_audit_action_length check (length(action) between 1 and 80),
  constraint staff_audit_entity_type_length check (length(entity_type) between 1 and 80),
  constraint staff_audit_summary_length check (length(summary) between 1 and 500),
  constraint staff_audit_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists staff_notifications_staff_created_idx
on public.staff_notifications (staff_id, created_at desc);

create index if not exists staff_notifications_unread_idx
on public.staff_notifications (staff_id, created_at desc)
where read_at is null;

create index if not exists staff_shift_swap_requester_created_idx
on public.staff_shift_swap_requests (requester_id, created_at desc);

create index if not exists staff_shift_swap_offered_created_idx
on public.staff_shift_swap_requests (offered_to, created_at desc);

create unique index if not exists staff_shift_swap_one_pending_per_shift_idx
on public.staff_shift_swap_requests (shift_id)
where status = 'pending';

create index if not exists staff_audit_log_created_idx
on public.staff_audit_log (created_at desc);

create index if not exists staff_audit_log_entity_idx
on public.staff_audit_log (entity_type, entity_id, created_at desc);

drop trigger if exists set_updated_at on public.staff_shift_swap_requests;
create trigger set_updated_at
before update on public.staff_shift_swap_requests
for each row execute function public.set_updated_at();

alter table public.staff_notifications enable row level security;
alter table public.staff_shift_swap_requests enable row level security;
alter table public.staff_audit_log enable row level security;

revoke all on public.staff_notifications from anon, authenticated;
revoke all on public.staff_shift_swap_requests from anon, authenticated;
revoke all on public.staff_audit_log from anon, authenticated;
grant all on public.staff_notifications to service_role;
grant all on public.staff_shift_swap_requests to service_role;
grant all on public.staff_audit_log to service_role;

comment on table public.staff_notifications is
  'Private in-app staff notifications. No email or SMS delivery is performed.';
comment on table public.staff_shift_swap_requests is
  'Manager-reviewed requests to reassign a future published shift to another active employee.';
comment on table public.staff_audit_log is
  'Append-only staff operations history. It is not an attendance or payroll record.';
