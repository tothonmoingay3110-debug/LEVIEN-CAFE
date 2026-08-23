-- Allow the legacy order insert inside create_checkout_order_v3 to complete.
-- The v3 wrapper calculates and writes the final amount_due immediately after
-- the base order row is created, within the same database transaction.

alter table public.orders
alter column amount_due set default 0;

comment on column public.orders.amount_due is
  'Remaining amount to collect. Defaults to zero during base order creation and is finalized atomically by create_checkout_order_v3.';
