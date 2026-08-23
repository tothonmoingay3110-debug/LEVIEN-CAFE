-- LEVIEN CAFE — V3 Business Intelligence
-- Modules 2, 3, 4, 5 and 7. POS import (Module 6) is intentionally excluded.

alter table public.orders
  add column if not exists promotion_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_promotion_id_fkey'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_promotion_id_fkey
      foreign key (promotion_id) references public.promotions(id) on delete set null;
  end if;
end;
$$;

create index if not exists orders_promotion_created_idx
  on public.orders (promotion_id, created_at desc)
  where promotion_id is not null;

create table if not exists public.promotion_events (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  event_type text not null check (event_type in ('impression', 'click')),
  session_key text not null check (char_length(session_key) between 8 and 80),
  created_at timestamptz not null default now()
);

create index if not exists promotion_events_reporting_idx
  on public.promotion_events (promotion_id, event_type, created_at desc);

alter table public.promotion_events enable row level security;

revoke all on public.promotion_events from anon, authenticated;
grant all on public.promotion_events to service_role;

comment on column public.orders.promotion_id is
  'Homepage promotion attributed to this order. Does not change checkout pricing.';

comment on table public.promotion_events is
  'Privacy-conscious promotion impressions and clicks. session_key is random and contains no customer contact data.';
