create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  title text not null,
  message text not null default '',
  target_view text not null default '',
  target_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint admin_notifications_text_length check (length(title) between 1 and 160 and length(message) <= 500)
);

create index if not exists admin_notifications_unread_idx
on public.admin_notifications (created_at desc) where read_at is null;

alter table public.admin_notifications enable row level security;
revoke all on public.admin_notifications from anon, authenticated;
grant all on public.admin_notifications to service_role;

alter table public.promotions add column if not exists display_mode text not null default 'designed';
alter table public.promotions add column if not exists mobile_image_url text not null default '';
alter table public.promotions add column if not exists link_url text not null default '/menu';
alter table public.promotions add constraint promotions_display_mode_valid check (display_mode in ('designed','full_image'));
