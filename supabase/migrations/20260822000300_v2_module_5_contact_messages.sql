-- V2 Restaurant Operations — Module 5: Contact Us inbox.
-- Public visitors submit through the server API. Browser roles receive no
-- direct table access; Owner and Manager actions are authorized server-side.

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null default '',
  subject text not null,
  message text not null,
  status text not null default 'new',
  admin_note text not null default '',
  handled_by uuid references public.staff_profiles(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_messages_name_length check (length(trim(name)) between 2 and 100),
  constraint contact_messages_email_length check (length(trim(email)) between 3 and 254),
  constraint contact_messages_phone_length check (length(phone) <= 30),
  constraint contact_messages_subject_length check (length(trim(subject)) between 2 and 80),
  constraint contact_messages_message_length check (length(trim(message)) between 10 and 2000),
  constraint contact_messages_note_length check (length(admin_note) <= 1000),
  constraint contact_messages_status_valid check (status in ('new', 'in_progress', 'resolved', 'archived'))
);

create index if not exists contact_messages_status_created_idx
on public.contact_messages (status, created_at desc);

create index if not exists contact_messages_created_idx
on public.contact_messages (created_at desc);

drop trigger if exists set_updated_at on public.contact_messages;
create trigger set_updated_at
before update on public.contact_messages
for each row execute function public.set_updated_at();

alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from anon, authenticated;
grant all on public.contact_messages to service_role;

comment on table public.contact_messages is
  'Customer contact submissions managed privately by Owner and Manager through the server API.';
