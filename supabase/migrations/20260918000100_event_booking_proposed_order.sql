alter table public.event_booking_requests
  add column if not exists proposed_order jsonb not null default '{"items":[],"subtotal":0,"tax":0,"total":0}'::jsonb;

alter table public.event_booking_requests
  drop constraint if exists event_booking_proposed_order_object;

alter table public.event_booking_requests
  add constraint event_booking_proposed_order_object
  check (jsonb_typeof(proposed_order) = 'object');
