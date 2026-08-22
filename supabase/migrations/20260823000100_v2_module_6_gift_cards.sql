-- V2 Restaurant Operations — Module 6: Gift Cards.
-- Card codes are generated server-side and stored only as SHA-256 hashes.

create table if not exists public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  code_last_four text not null,
  initial_balance numeric(10,2) not null,
  balance numeric(10,2) not null,
  currency text not null default 'USD',
  recipient_name text not null default '',
  recipient_email text,
  note text not null default '',
  status text not null default 'active',
  expires_on date,
  issued_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gift_cards_hash_length check (length(code_hash) = 64),
  constraint gift_cards_last_four_length check (length(code_last_four) = 4),
  constraint gift_cards_initial_balance_valid check (initial_balance > 0 and initial_balance <= 10000),
  constraint gift_cards_balance_valid check (balance >= 0 and balance <= initial_balance),
  constraint gift_cards_currency_valid check (currency = 'USD'),
  constraint gift_cards_recipient_name_length check (length(recipient_name) <= 120),
  constraint gift_cards_recipient_email_length check (recipient_email is null or length(recipient_email) <= 254),
  constraint gift_cards_note_length check (length(note) <= 1000),
  constraint gift_cards_status_valid check (status in ('active', 'disabled', 'redeemed'))
);

alter table public.orders
add column if not exists gift_card_id uuid references public.gift_cards(id) on delete restrict;

alter table public.orders
add column if not exists gift_card_amount numeric(10,2) not null default 0
check (gift_card_amount >= 0 and gift_card_amount <= total);

create table if not exists public.gift_card_transactions (
  id uuid primary key default gen_random_uuid(),
  gift_card_id uuid not null references public.gift_cards(id) on delete restrict,
  transaction_type text not null,
  amount numeric(10,2) not null,
  balance_after numeric(10,2) not null,
  order_id uuid references public.orders(id) on delete restrict,
  created_by uuid references public.staff_profiles(id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint gift_card_transactions_type_valid check (transaction_type in ('issue', 'redeem', 'refund')),
  constraint gift_card_transactions_amount_nonzero check (amount <> 0),
  constraint gift_card_transactions_balance_valid check (balance_after >= 0),
  constraint gift_card_transactions_note_length check (length(note) <= 500)
);

create index if not exists gift_cards_status_created_idx
on public.gift_cards (status, created_at desc);

create index if not exists gift_cards_recipient_email_idx
on public.gift_cards (recipient_email) where recipient_email is not null;

create index if not exists gift_card_transactions_card_created_idx
on public.gift_card_transactions (gift_card_id, created_at desc);

create index if not exists gift_card_transactions_order_idx
on public.gift_card_transactions (order_id) where order_id is not null;

drop trigger if exists set_updated_at on public.gift_cards;
create trigger set_updated_at
before update on public.gift_cards
for each row execute function public.set_updated_at();

alter table public.gift_cards enable row level security;
alter table public.gift_card_transactions enable row level security;
revoke all on public.gift_cards from anon, authenticated;
revoke all on public.gift_card_transactions from anon, authenticated;
grant all on public.gift_cards to service_role;
grant all on public.gift_card_transactions to service_role;

create or replace function public.issue_gift_card(
  p_code_hash text,
  p_code_last_four text,
  p_initial_balance numeric,
  p_recipient_name text,
  p_recipient_email text,
  p_note text,
  p_expires_on date,
  p_issued_by uuid
)
returns table (gift_card_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_gift_card_id uuid;
  v_balance numeric(10,2) := round(p_initial_balance, 2);
begin
  if length(p_code_hash) <> 64 or length(p_code_last_four) <> 4 then
    raise exception 'Invalid gift card code metadata';
  end if;
  if v_balance <= 0 or v_balance > 10000 then
    raise exception 'Gift card amount must be between 0.01 and 10000';
  end if;
  if p_expires_on is not null and p_expires_on < current_date then
    raise exception 'Gift card expiry must be today or later';
  end if;

  insert into public.gift_cards (
    code_hash, code_last_four, initial_balance, balance, recipient_name,
    recipient_email, note, expires_on, issued_by
  ) values (
    p_code_hash, p_code_last_four, v_balance, v_balance,
    left(coalesce(p_recipient_name, ''), 120),
    nullif(left(coalesce(p_recipient_email, ''), 254), ''),
    left(coalesce(p_note, ''), 1000), p_expires_on, p_issued_by
  ) returning id into v_gift_card_id;

  insert into public.gift_card_transactions (
    gift_card_id, transaction_type, amount, balance_after, created_by, note
  ) values (
    v_gift_card_id, 'issue', v_balance, v_balance, p_issued_by, 'Gift card issued'
  );

  return query select v_gift_card_id;
end;
$$;

create or replace function public.create_checkout_order_with_gift_card(
  p_first_name text, p_last_name text, p_phone text, p_phone_normalized text,
  p_email text, p_fulfillment_type text, p_pickup_time text, p_address text,
  p_city text, p_zip text, p_apartment text, p_payment_method text,
  p_subtotal numeric, p_tax numeric, p_delivery_fee numeric, p_total numeric,
  p_note text, p_items jsonb, p_gift_card_hash text
)
returns table (
  order_number text,
  gift_card_amount numeric,
  gift_card_balance numeric,
  final_payment_method text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_number text;
  v_order_id uuid;
  v_gift_card public.gift_cards%rowtype;
  v_gift_amount numeric(10,2) := 0;
  v_remaining numeric(10,2);
  v_payment_method text := p_payment_method;
begin
  if nullif(p_gift_card_hash, '') is not null then
    select * into v_gift_card
    from public.gift_cards
    where code_hash = p_gift_card_hash
    for update;

    if not found then raise exception 'GIFT_CARD_INVALID'; end if;
    if v_gift_card.status <> 'active' then raise exception 'GIFT_CARD_INACTIVE'; end if;
    if v_gift_card.expires_on is not null and v_gift_card.expires_on < current_date then
      raise exception 'GIFT_CARD_EXPIRED';
    end if;
    if v_gift_card.balance <= 0 then raise exception 'GIFT_CARD_EMPTY'; end if;

    v_gift_amount := round(least(v_gift_card.balance, p_total), 2);
    if v_gift_amount >= p_total then
      v_payment_method := 'Gift Card';
    else
      v_payment_method := 'Gift Card + ' || p_payment_method;
    end if;
  end if;

  select created.order_number into v_order_number
  from public.create_checkout_order(
    p_first_name, p_last_name, p_phone, p_phone_normalized, p_email,
    p_fulfillment_type, p_pickup_time, p_address, p_city, p_zip, p_apartment,
    v_payment_method, p_subtotal, p_tax, p_delivery_fee, p_total, p_note, p_items
  ) as created
  limit 1;

  select id into v_order_id
  from public.orders
  where orders.order_number = v_order_number;

  if v_gift_amount > 0 then
    update public.orders set
      gift_card_id = v_gift_card.id,
      gift_card_amount = v_gift_amount
    where id = v_order_id;

    update public.gift_cards set
      balance = round(balance - v_gift_amount, 2),
      status = case when round(balance - v_gift_amount, 2) <= 0 then 'redeemed' else status end
    where id = v_gift_card.id
    returning balance into v_remaining;

    insert into public.gift_card_transactions (
      gift_card_id, transaction_type, amount, balance_after, order_id, note
    ) values (
      v_gift_card.id, 'redeem', -v_gift_amount, v_remaining, v_order_id,
      'Redeemed on order ' || v_order_number
    );
  else
    v_remaining := null;
  end if;

  return query select v_order_number, v_gift_amount, v_remaining, v_payment_method;
end;
$$;

create or replace function public.update_order_status_with_gift_card(
  p_order_number text,
  p_status text,
  p_actor_id uuid
)
returns table (order_number text, order_status text, gift_card_refund numeric)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_card public.gift_cards%rowtype;
  v_refund numeric(10,2) := 0;
  v_balance numeric(10,2);
begin
  if p_status not in ('New', 'Preparing', 'Ready', 'Completed', 'Cancelled') then
    raise exception 'Invalid order status';
  end if;

  select * into v_order
  from public.orders
  where orders.order_number = p_order_number
  for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status = 'Cancelled' and p_status <> 'Cancelled' then
    raise exception 'ORDER_CANCELLED_FINAL';
  end if;

  if p_status = 'Cancelled' and v_order.status <> 'Cancelled' and
     v_order.gift_card_id is not null and v_order.gift_card_amount > 0 then
    select * into v_card
    from public.gift_cards
    where id = v_order.gift_card_id
    for update;

    if found then
      v_refund := v_order.gift_card_amount;
      v_balance := least(v_card.initial_balance, round(v_card.balance + v_refund, 2));
      update public.gift_cards set
        balance = v_balance,
        status = case when status = 'redeemed' and v_balance > 0 then 'active' else status end
      where id = v_card.id;

      insert into public.gift_card_transactions (
        gift_card_id, transaction_type, amount, balance_after, order_id,
        created_by, note
      ) values (
        v_card.id, 'refund', v_refund, v_balance, v_order.id, p_actor_id,
        'Refunded after order ' || v_order.order_number || ' was cancelled'
      );
    end if;
  end if;

  update public.orders set status = p_status where id = v_order.id;
  return query select v_order.order_number, p_status, v_refund;
end;
$$;

revoke all on function public.issue_gift_card(text, text, numeric, text, text, text, date, uuid) from public;
grant execute on function public.issue_gift_card(text, text, numeric, text, text, text, date, uuid) to service_role;

revoke all on function public.create_checkout_order_with_gift_card(
  text, text, text, text, text, text, text, text, text, text, text, text,
  numeric, numeric, numeric, numeric, text, jsonb, text
) from public;
grant execute on function public.create_checkout_order_with_gift_card(
  text, text, text, text, text, text, text, text, text, text, text, text,
  numeric, numeric, numeric, numeric, text, jsonb, text
) to service_role;

revoke all on function public.update_order_status_with_gift_card(text, text, uuid) from public;
grant execute on function public.update_order_status_with_gift_card(text, text, uuid) to service_role;

comment on table public.gift_cards is
  'Hashed bearer gift cards issued by Owner or Manager and redeemed atomically during checkout.';

comment on table public.gift_card_transactions is
  'Immutable financial history for gift card issue, redemption and cancellation refund events.';
