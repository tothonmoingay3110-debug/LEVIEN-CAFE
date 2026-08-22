-- V2 Customer Accounts, Stripe payments, Membership Cards and configurable loyalty.
-- Run after 20260823000100_v2_module_6_gift_cards.sql.

create or replace function public.generate_membership_number()
returns text
language sql
volatile
set search_path = public, pg_temp
as $$
  select 'LV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
$$;

create or replace function public.generate_loyalty_reward_code()
returns text
language sql
volatile
set search_path = public, pg_temp
as $$
  select 'LVR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
$$;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  legacy_customer_id uuid unique references public.customers(id) on delete set null,
  email text not null,
  first_name text not null default '',
  last_name text not null default '',
  phone text not null default '',
  membership_number text not null unique default public.generate_membership_number(),
  email_verified_at timestamptz,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_profiles_email_length check (length(email) between 3 and 254),
  constraint customer_profiles_name_length check (length(first_name) <= 100 and length(last_name) <= 100),
  constraint customer_profiles_phone_length check (length(phone) <= 30),
  constraint customer_profiles_membership_format check (membership_number ~ '^LV-[A-F0-9]{10}$')
);

create index if not exists customer_profiles_email_idx
on public.customer_profiles (lower(email));

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete restrict,
  provider text not null,
  status text not null default 'pending',
  amount numeric(10,2) not null,
  currency text not null default 'USD',
  provider_session_id text,
  provider_payment_id text,
  failure_message text not null default '',
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_provider_valid check (provider in ('stripe', 'offline', 'gift_card')),
  constraint payments_status_valid check (status in ('pending', 'unpaid', 'paid', 'failed', 'expired', 'refunded')),
  constraint payments_amount_valid check (amount >= 0 and amount <= 100000),
  constraint payments_currency_valid check (currency = 'USD'),
  constraint payments_failure_length check (length(failure_message) <= 500)
);

create unique index if not exists payments_provider_session_unique
on public.payments (provider, provider_session_id)
where provider_session_id is not null;

create unique index if not exists payments_provider_payment_unique
on public.payments (provider, provider_payment_id)
where provider_payment_id is not null;

create index if not exists payments_order_created_idx
on public.payments (order_id, created_at desc);

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  object_id text not null default '',
  processed_at timestamptz not null default now()
);

create table if not exists public.gift_card_sales (
  id uuid primary key default gen_random_uuid(),
  purchaser_profile_id uuid references public.customer_profiles(id) on delete set null,
  purchaser_email text not null,
  recipient_name text not null,
  recipient_email text not null,
  personal_message text not null default '',
  amount numeric(10,2) not null,
  currency text not null default 'USD',
  sales_channel text not null,
  status text not null default 'pending',
  tender_type text not null default 'stripe',
  receipt_reference text not null default '',
  pending_code_hash text not null,
  pending_code_last_four text not null,
  pending_code_ciphertext text not null,
  gift_card_id uuid references public.gift_cards(id) on delete restrict,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  delivery_status text not null default 'pending',
  delivery_provider_id text,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gift_card_sales_amount_valid check (amount between 5 and 1000),
  constraint gift_card_sales_currency_valid check (currency = 'USD'),
  constraint gift_card_sales_channel_valid check (sales_channel in ('online', 'in_store', 'complimentary')),
  constraint gift_card_sales_status_valid check (status in ('pending', 'paid', 'failed', 'expired', 'refunded', 'refund_review')),
  constraint gift_card_sales_tender_valid check (tender_type in ('stripe', 'cash', 'card_terminal', 'complimentary')),
  constraint gift_card_sales_delivery_valid check (delivery_status in ('pending', 'sent', 'manual_required', 'failed')),
  constraint gift_card_sales_hash_length check (length(pending_code_hash) = 64),
  constraint gift_card_sales_last_four_length check (length(pending_code_last_four) = 4),
  constraint gift_card_sales_email_length check (length(purchaser_email) <= 254 and length(recipient_email) <= 254),
  constraint gift_card_sales_message_length check (length(personal_message) <= 500),
  constraint gift_card_sales_reference_length check (length(receipt_reference) <= 120)
);

create index if not exists gift_card_sales_profile_created_idx
on public.gift_card_sales (purchaser_profile_id, created_at desc);

create index if not exists gift_card_sales_status_created_idx
on public.gift_card_sales (status, created_at desc);

alter table public.gift_cards
add column if not exists code_ciphertext text;

alter table public.gift_cards
add column if not exists owner_profile_id uuid references public.customer_profiles(id) on delete set null;

alter table public.gift_cards
add column if not exists sale_id uuid unique references public.gift_card_sales(id) on delete set null;

alter table public.gift_cards
add column if not exists source text not null default 'legacy';

alter table public.gift_cards
drop constraint if exists gift_cards_source_valid;

alter table public.gift_cards
add constraint gift_cards_source_valid check (source in ('legacy', 'online', 'in_store', 'complimentary'));

create table if not exists public.loyalty_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  trigger_product_id uuid not null references public.products(id) on delete restrict,
  required_quantity integer not null,
  reward_type text not null,
  reward_product_id uuid references public.products(id) on delete restrict,
  reward_name text not null,
  repeatable boolean not null default true,
  reward_expires_days integer not null default 90,
  active boolean not null default true,
  starts_on date not null default current_date,
  ends_on date,
  created_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loyalty_rules_name_length check (length(trim(name)) between 2 and 120),
  constraint loyalty_rules_description_length check (length(description) <= 500),
  constraint loyalty_rules_quantity_valid check (required_quantity between 1 and 1000),
  constraint loyalty_rules_reward_type_valid check (reward_type in ('free_product', 'physical_gift')),
  constraint loyalty_rules_reward_name_length check (length(trim(reward_name)) between 2 and 120),
  constraint loyalty_rules_reward_product_valid check (
    (reward_type = 'free_product' and reward_product_id is not null) or
    (reward_type = 'physical_gift' and reward_product_id is null)
  ),
  constraint loyalty_rules_expiry_valid check (reward_expires_days between 1 and 730),
  constraint loyalty_rules_dates_valid check (ends_on is null or ends_on >= starts_on)
);

create index if not exists loyalty_rules_active_product_idx
on public.loyalty_rules (active, trigger_product_id, starts_on);

create table if not exists public.loyalty_progress (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  rule_id uuid not null references public.loyalty_rules(id) on delete cascade,
  units_earned integer not null default 0,
  review_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_profile_id, rule_id),
  constraint loyalty_progress_units_valid check (units_earned >= 0)
);

create table if not exists public.loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  rule_id uuid not null references public.loyalty_rules(id) on delete restrict,
  reward_code text not null unique default public.generate_loyalty_reward_code(),
  reward_type text not null,
  reward_product_id uuid references public.products(id) on delete restrict,
  reward_name text not null,
  status text not null default 'issued',
  source_order_id uuid references public.orders(id) on delete restrict,
  redemption_order_id uuid references public.orders(id) on delete restrict,
  redeemed_by uuid references public.staff_profiles(id) on delete set null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  redeemed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint loyalty_rewards_type_valid check (reward_type in ('free_product', 'physical_gift')),
  constraint loyalty_rewards_status_valid check (status in ('issued', 'reserved', 'redeemed', 'revoked', 'expired')),
  constraint loyalty_rewards_name_length check (length(trim(reward_name)) between 2 and 120)
);

create index if not exists loyalty_rewards_profile_status_idx
on public.loyalty_rewards (customer_profile_id, status, issued_at desc);

create index if not exists loyalty_rewards_rule_status_idx
on public.loyalty_rewards (rule_id, status, issued_at desc);

create table if not exists public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid not null references public.customer_profiles(id) on delete cascade,
  rule_id uuid not null references public.loyalty_rules(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  entry_type text not null,
  units integer not null,
  created_at timestamptz not null default now(),
  unique (order_id, rule_id, entry_type),
  constraint loyalty_ledger_type_valid check (entry_type in ('earn', 'reversal')),
  constraint loyalty_ledger_units_valid check (
    (entry_type = 'earn' and units > 0) or (entry_type = 'reversal' and units < 0)
  )
);

alter table public.orders
add column if not exists customer_profile_id uuid references public.customer_profiles(id) on delete set null;

alter table public.orders
add column if not exists payment_status text not null default 'unpaid';

alter table public.orders
add column if not exists payment_provider text not null default 'offline';

alter table public.orders
add column if not exists amount_due numeric(10,2);

alter table public.orders
add column if not exists stripe_checkout_session_id text;

alter table public.orders
add column if not exists stripe_payment_intent_id text;

alter table public.orders
add column if not exists loyalty_reward_id uuid references public.loyalty_rewards(id) on delete restrict;

alter table public.orders
add column if not exists loyalty_discount numeric(10,2) not null default 0;

update public.orders
set amount_due = greatest(0, round(total - gift_card_amount - loyalty_discount, 2))
where amount_due is null;

alter table public.orders alter column amount_due set not null;

alter table public.orders
drop constraint if exists orders_status_check;

alter table public.orders
add constraint orders_status_check check (status in ('Pending Payment', 'New', 'Preparing', 'Ready', 'Completed', 'Cancelled'));

alter table public.orders
drop constraint if exists orders_payment_status_check;

alter table public.orders
add constraint orders_payment_status_check check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'expired', 'refunded'));

alter table public.orders
drop constraint if exists orders_payment_provider_check;

alter table public.orders
add constraint orders_payment_provider_check check (payment_provider in ('offline', 'stripe', 'gift_card', 'mixed'));

alter table public.orders
drop constraint if exists orders_amount_due_check;

alter table public.orders
add constraint orders_amount_due_check check (amount_due >= 0 and amount_due <= total);

alter table public.orders
drop constraint if exists orders_loyalty_discount_check;

alter table public.orders
add constraint orders_loyalty_discount_check check (loyalty_discount >= 0 and loyalty_discount <= total);

create unique index if not exists orders_stripe_checkout_session_unique
on public.orders (stripe_checkout_session_id)
where stripe_checkout_session_id is not null;

create unique index if not exists orders_stripe_payment_intent_unique
on public.orders (stripe_payment_intent_id)
where stripe_payment_intent_id is not null;

create index if not exists orders_customer_profile_created_idx
on public.orders (customer_profile_id, created_at desc)
where customer_profile_id is not null;

create unique index if not exists gift_card_transactions_order_type_unique
on public.gift_card_transactions (order_id, transaction_type)
where order_id is not null and transaction_type in ('redeem', 'refund');

drop trigger if exists set_updated_at on public.customer_profiles;
create trigger set_updated_at before update on public.customer_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.payments;
create trigger set_updated_at before update on public.payments
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.gift_card_sales;
create trigger set_updated_at before update on public.gift_card_sales
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.loyalty_rules;
create trigger set_updated_at before update on public.loyalty_rules
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.loyalty_progress;
create trigger set_updated_at before update on public.loyalty_progress
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.loyalty_rewards;
create trigger set_updated_at before update on public.loyalty_rewards
for each row execute function public.set_updated_at();

create or replace function public.handle_new_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'account_type', '') <> 'customer' then
    return new;
  end if;

  insert into public.customer_profiles (
    auth_user_id, email, first_name, last_name, phone, email_verified_at,
    marketing_opt_in
  ) values (
    new.id,
    lower(coalesce(new.email, '')),
    left(coalesce(new.raw_user_meta_data ->> 'first_name', ''), 100),
    left(coalesce(new.raw_user_meta_data ->> 'last_name', ''), 100),
    left(coalesce(new.raw_user_meta_data ->> 'phone', ''), 30),
    new.email_confirmed_at,
    coalesce((new.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false)
  )
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_customer_created on auth.users;
create trigger on_auth_customer_created
after insert on auth.users
for each row execute function public.handle_new_customer_profile();

create or replace function public.apply_loyalty_for_order(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_rule public.loyalty_rules%rowtype;
  v_units integer;
  v_progress public.loyalty_progress%rowtype;
  v_existing_rewards integer;
  v_target_rewards integer;
  v_created integer := 0;
  v_index integer;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.status <> 'Completed' or v_order.customer_profile_id is null then
    return 0;
  end if;

  for v_rule in
    select * from public.loyalty_rules
    where active = true
      and starts_on <= v_order.created_at::date
      and (ends_on is null or ends_on >= v_order.created_at::date)
    for update
  loop
    select coalesce(sum(matched.quantity), 0)::integer into v_units
    from (
      select oi.quantity
      from public.order_items oi
      where oi.order_id = v_order.id and oi.product_id = v_rule.trigger_product_id
      union all
      select parent.quantity
      from public.order_combo_items child
      join public.order_items parent on parent.id = child.order_item_id
      where parent.order_id = v_order.id and child.product_id = v_rule.trigger_product_id
    ) matched;

    if v_units <= 0 then continue; end if;

    insert into public.loyalty_ledger (
      customer_profile_id, rule_id, order_id, entry_type, units
    ) values (
      v_order.customer_profile_id, v_rule.id, v_order.id, 'earn', v_units
    ) on conflict (order_id, rule_id, entry_type) do nothing;

    if not found then continue; end if;

    insert into public.loyalty_progress (customer_profile_id, rule_id, units_earned)
    values (v_order.customer_profile_id, v_rule.id, v_units)
    on conflict (customer_profile_id, rule_id) do update set
      units_earned = loyalty_progress.units_earned + excluded.units_earned,
      updated_at = now()
    returning * into v_progress;

    select count(*)::integer into v_existing_rewards
    from public.loyalty_rewards
    where customer_profile_id = v_order.customer_profile_id
      and rule_id = v_rule.id
      and status <> 'revoked';

    v_target_rewards := floor(v_progress.units_earned::numeric / v_rule.required_quantity)::integer;
    if not v_rule.repeatable then v_target_rewards := least(v_target_rewards, 1); end if;

    if v_target_rewards > v_existing_rewards then
      for v_index in 1..(v_target_rewards - v_existing_rewards) loop
        insert into public.loyalty_rewards (
          customer_profile_id, rule_id, reward_type, reward_product_id,
          reward_name, source_order_id, expires_at
        ) values (
          v_order.customer_profile_id, v_rule.id, v_rule.reward_type,
          v_rule.reward_product_id, v_rule.reward_name, v_order.id,
          now() + make_interval(days => v_rule.reward_expires_days)
        );
        v_created := v_created + 1;
      end loop;
    end if;
  end loop;

  return v_created;
end;
$$;

create or replace function public.reverse_loyalty_for_order(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entry public.loyalty_ledger%rowtype;
  v_rule public.loyalty_rules%rowtype;
  v_progress public.loyalty_progress%rowtype;
  v_target integer;
  v_current integer;
  v_to_revoke integer;
  v_revoked integer := 0;
  v_just_revoked integer := 0;
begin
  for v_entry in
    select * from public.loyalty_ledger
    where order_id = p_order_id and entry_type = 'earn'
    for update
  loop
    insert into public.loyalty_ledger (
      customer_profile_id, rule_id, order_id, entry_type, units
    ) values (
      v_entry.customer_profile_id, v_entry.rule_id, p_order_id, 'reversal', -v_entry.units
    ) on conflict (order_id, rule_id, entry_type) do nothing;
    if not found then continue; end if;

    update public.loyalty_progress set
      units_earned = greatest(0, units_earned - v_entry.units),
      updated_at = now()
    where customer_profile_id = v_entry.customer_profile_id and rule_id = v_entry.rule_id
    returning * into v_progress;

    select * into v_rule from public.loyalty_rules where id = v_entry.rule_id;
    v_target := floor(v_progress.units_earned::numeric / v_rule.required_quantity)::integer;
    if not v_rule.repeatable then v_target := least(v_target, 1); end if;

    select count(*)::integer into v_current
    from public.loyalty_rewards
    where customer_profile_id = v_entry.customer_profile_id
      and rule_id = v_entry.rule_id
      and status <> 'revoked';

    v_to_revoke := greatest(0, v_current - v_target);
    if v_to_revoke > 0 then
      with candidates as (
        select id from public.loyalty_rewards
        where customer_profile_id = v_entry.customer_profile_id
          and rule_id = v_entry.rule_id
          and status in ('issued', 'reserved')
        order by issued_at desc
        limit v_to_revoke
        for update
      )
      update public.loyalty_rewards reward set status = 'revoked', updated_at = now()
      from candidates where reward.id = candidates.id;
      get diagnostics v_just_revoked = row_count;
      v_revoked := v_revoked + v_just_revoked;

      if v_current - v_just_revoked > v_target then
        update public.loyalty_progress set review_required = true
        where id = v_progress.id;
      end if;
    end if;
  end loop;
  return v_revoked;
end;
$$;

create or replace function public.restore_order_benefits(
  p_order_id uuid,
  p_actor_id uuid
)
returns table (gift_card_refund numeric, loyalty_reward_restored boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_card public.gift_cards%rowtype;
  v_balance numeric(10,2);
  v_gift_refund numeric(10,2) := 0;
  v_reward_restored boolean := false;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;

  if v_order.gift_card_id is not null and v_order.gift_card_amount > 0 and not exists (
    select 1 from public.gift_card_transactions
    where order_id = v_order.id and transaction_type = 'refund'
  ) then
    select * into v_card from public.gift_cards where id = v_order.gift_card_id for update;
    if found then
      v_gift_refund := v_order.gift_card_amount;
      v_balance := least(v_card.initial_balance, round(v_card.balance + v_gift_refund, 2));
      update public.gift_cards set
        balance = v_balance,
        status = case when status = 'redeemed' and v_balance > 0 then 'active' else status end
      where id = v_card.id;
      insert into public.gift_card_transactions (
        gift_card_id, transaction_type, amount, balance_after, order_id,
        created_by, note
      ) values (
        v_card.id, 'refund', v_gift_refund, v_balance, v_order.id, p_actor_id,
        'Restored after order ' || v_order.order_number || ' was cancelled'
      );
    end if;
  end if;

  if v_order.loyalty_reward_id is not null then
    update public.loyalty_rewards set
      status = 'issued', redemption_order_id = null, redeemed_at = null,
      redeemed_by = null, updated_at = now()
    where id = v_order.loyalty_reward_id
      and redemption_order_id = v_order.id
      and status in ('reserved', 'redeemed')
      and (expires_at is null or expires_at > now());
    v_reward_restored := found;
  end if;

  perform public.reverse_loyalty_for_order(v_order.id);
  return query select v_gift_refund, v_reward_restored;
end;
$$;

create or replace function public.create_checkout_order_v3(
  p_first_name text, p_last_name text, p_phone text, p_phone_normalized text,
  p_email text, p_fulfillment_type text, p_pickup_time text, p_address text,
  p_city text, p_zip text, p_apartment text, p_payment_method text,
  p_subtotal numeric, p_tax numeric, p_delivery_fee numeric, p_total numeric,
  p_note text, p_items jsonb, p_gift_card_hash text,
  p_customer_profile_id uuid, p_payment_channel text, p_loyalty_reward_id uuid
)
returns table (
  order_number text,
  order_id uuid,
  gift_card_amount numeric,
  gift_card_balance numeric,
  loyalty_discount numeric,
  amount_due numeric,
  payment_status text,
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
  v_reward public.loyalty_rewards%rowtype;
  v_reward_price numeric(10,2) := 0;
  v_gift_amount numeric(10,2) := 0;
  v_remaining numeric(10,2);
  v_amount_due numeric(10,2);
  v_payment_status text;
  v_order_status text := 'New';
  v_payment_provider text;
  v_payment_method text := p_payment_method;
begin
  if p_payment_channel not in ('offline', 'stripe') then raise exception 'INVALID_PAYMENT_CHANNEL'; end if;
  if p_customer_profile_id is not null and not exists (
    select 1 from public.customer_profiles where id = p_customer_profile_id
  ) then raise exception 'CUSTOMER_PROFILE_NOT_FOUND'; end if;

  if p_loyalty_reward_id is not null then
    if p_customer_profile_id is null then raise exception 'LOYALTY_LOGIN_REQUIRED'; end if;
    select * into v_reward from public.loyalty_rewards
    where id = p_loyalty_reward_id for update;
    if not found or v_reward.customer_profile_id <> p_customer_profile_id or
       v_reward.status <> 'issued' or v_reward.reward_type <> 'free_product' or
       (v_reward.expires_at is not null and v_reward.expires_at <= now()) then
      raise exception 'LOYALTY_REWARD_INVALID';
    end if;
    if not exists (
      select 1 from jsonb_array_elements(p_items) item
      where item ->> 'itemType' = 'product'
        and item ->> 'productId' = v_reward.reward_product_id::text
        and coalesce((item ->> 'quantity')::integer, 0) > 0
    ) then raise exception 'LOYALTY_PRODUCT_REQUIRED'; end if;
    select price into v_reward_price from public.products where id = v_reward.reward_product_id and active = true;
    if v_reward_price is null then raise exception 'LOYALTY_PRODUCT_UNAVAILABLE'; end if;
    v_reward_price := round(least(v_reward_price, p_total), 2);
  end if;

  if nullif(p_gift_card_hash, '') is not null then
    select * into v_gift_card from public.gift_cards
    where code_hash = p_gift_card_hash for update;
    if not found then raise exception 'GIFT_CARD_INVALID'; end if;
    if v_gift_card.status <> 'active' then raise exception 'GIFT_CARD_INACTIVE'; end if;
    if v_gift_card.expires_on is not null and v_gift_card.expires_on < current_date then raise exception 'GIFT_CARD_EXPIRED'; end if;
    if v_gift_card.balance <= 0 then raise exception 'GIFT_CARD_EMPTY'; end if;
    v_gift_amount := round(least(v_gift_card.balance, greatest(0, p_total - v_reward_price)), 2);
  end if;

  v_amount_due := round(greatest(0, p_total - v_reward_price - v_gift_amount), 2);
  if v_amount_due = 0 then
    v_payment_status := 'paid';
    v_payment_provider := case when v_gift_amount > 0 then 'gift_card' else 'offline' end;
    v_payment_method := case
      when v_gift_amount > 0 and v_reward_price > 0 then 'Gift Card + Loyalty Reward'
      when v_gift_amount > 0 then 'Gift Card'
      else 'Loyalty Reward'
    end;
  elsif p_payment_channel = 'stripe' then
    v_payment_status := 'pending';
    v_payment_provider := case when v_gift_amount > 0 or v_reward_price > 0 then 'mixed' else 'stripe' end;
    v_order_status := 'Pending Payment';
    v_payment_method := case when v_gift_amount > 0 or v_reward_price > 0 then 'Online Card + Benefits' else 'Online Card' end;
  else
    v_payment_status := 'unpaid';
    v_payment_provider := case when v_gift_amount > 0 or v_reward_price > 0 then 'mixed' else 'offline' end;
    v_payment_method := case when v_gift_amount > 0 or v_reward_price > 0 then p_payment_method || ' + Benefits' else p_payment_method end;
  end if;

  select created.order_number into v_order_number
  from public.create_checkout_order(
    p_first_name, p_last_name, p_phone, p_phone_normalized, p_email,
    p_fulfillment_type, p_pickup_time, p_address, p_city, p_zip, p_apartment,
    v_payment_method, p_subtotal, p_tax, p_delivery_fee, p_total, p_note, p_items
  ) as created limit 1;

  select id into v_order_id from public.orders where orders.order_number = v_order_number;
  update public.orders set
    customer_profile_id = p_customer_profile_id,
    status = v_order_status,
    payment_status = v_payment_status,
    payment_provider = v_payment_provider,
    amount_due = v_amount_due,
    loyalty_reward_id = p_loyalty_reward_id,
    loyalty_discount = v_reward_price
  where id = v_order_id;

  if v_gift_amount > 0 then
    update public.orders set gift_card_id = v_gift_card.id, gift_card_amount = v_gift_amount where id = v_order_id;
    update public.gift_cards set
      balance = round(balance - v_gift_amount, 2),
      status = case when round(balance - v_gift_amount, 2) <= 0 then 'redeemed' else status end
    where id = v_gift_card.id returning balance into v_remaining;
    insert into public.gift_card_transactions (
      gift_card_id, transaction_type, amount, balance_after, order_id, note
    ) values (
      v_gift_card.id, 'redeem', -v_gift_amount, v_remaining, v_order_id,
      'Redeemed on order ' || v_order_number
    );
  else
    v_remaining := null;
  end if;

  if p_loyalty_reward_id is not null then
    update public.loyalty_rewards set
      status = case when v_payment_status = 'pending' then 'reserved' else 'redeemed' end,
      redemption_order_id = v_order_id,
      redeemed_at = case when v_payment_status = 'pending' then null else now() end,
      updated_at = now()
    where id = p_loyalty_reward_id;
  end if;

  insert into public.payments (order_id, provider, status, amount)
  values (
    v_order_id,
    case when p_payment_channel = 'stripe' and v_amount_due > 0 then 'stripe'
         when v_amount_due = 0 then 'gift_card' else 'offline' end,
    v_payment_status,
    v_amount_due
  );

  return query select v_order_number, v_order_id, v_gift_amount, v_remaining,
    v_reward_price, v_amount_due, v_payment_status, v_payment_method;
end;
$$;

create or replace function public.update_order_status_v3(
  p_order_number text,
  p_status text,
  p_actor_id uuid,
  p_stripe_refunded boolean default false
)
returns table (
  order_number text,
  order_status text,
  gift_card_refund numeric,
  loyalty_reward_restored boolean,
  rewards_issued integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_gift_refund numeric(10,2) := 0;
  v_reward_restored boolean := false;
  v_rewards integer := 0;
begin
  if p_status not in ('Pending Payment', 'New', 'Preparing', 'Ready', 'Completed', 'Cancelled') then
    raise exception 'INVALID_ORDER_STATUS';
  end if;
  select * into v_order from public.orders where orders.order_number = p_order_number for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status = 'Cancelled' and p_status <> 'Cancelled' then raise exception 'ORDER_CANCELLED_FINAL'; end if;
  if v_order.status = 'Pending Payment' and p_status not in ('Pending Payment', 'Cancelled') then raise exception 'PAYMENT_NOT_CONFIRMED'; end if;
  if p_status = 'Cancelled' and v_order.payment_provider in ('stripe', 'mixed') and
     v_order.payment_status = 'paid' and not p_stripe_refunded then
    raise exception 'PAYMENT_REFUND_REQUIRED';
  end if;

  if p_status = 'Cancelled' and v_order.status <> 'Cancelled' then
    select benefits.gift_card_refund, benefits.loyalty_reward_restored
    into v_gift_refund, v_reward_restored
    from public.restore_order_benefits(v_order.id, p_actor_id) benefits;
    update public.orders set
      status = 'Cancelled',
      payment_status = case
        when payment_status = 'paid' and p_stripe_refunded then 'refunded'
        when payment_status = 'pending' then 'failed'
        else payment_status
      end
    where id = v_order.id;
    update public.payments set
      status = case when status = 'paid' and p_stripe_refunded then 'refunded' else status end,
      refunded_at = case when status = 'paid' and p_stripe_refunded then now() else refunded_at end
    where order_id = v_order.id;
  else
    update public.orders set status = p_status where id = v_order.id;
    if p_status = 'Completed' and v_order.status <> 'Completed' then
      v_rewards := public.apply_loyalty_for_order(v_order.id);
    end if;
  end if;

  return query select v_order.order_number, p_status,
    v_gift_refund, v_reward_restored, v_rewards;
end;
$$;

create or replace function public.process_stripe_order_event(
  p_event_id text,
  p_event_type text,
  p_session_id text,
  p_payment_intent_id text,
  p_amount_cents integer
)
returns table (processed boolean, order_number text, order_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_benefits record;
begin
  insert into public.stripe_webhook_events (event_id, event_type, object_id)
  values (p_event_id, p_event_type, coalesce(p_session_id, p_payment_intent_id, ''))
  on conflict (event_id) do nothing;
  if not found then
    select * into v_order from public.orders
    where stripe_checkout_session_id = p_session_id or stripe_payment_intent_id = p_payment_intent_id
    limit 1;
    return query select false, v_order.order_number, v_order.id;
    return;
  end if;

  select * into v_order from public.orders
  where stripe_checkout_session_id = p_session_id or
        (p_payment_intent_id is not null and stripe_payment_intent_id = p_payment_intent_id)
  for update;
  if not found then raise exception 'STRIPE_ORDER_NOT_FOUND'; end if;

  if p_event_type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded') then
    if p_amount_cents <> round(v_order.amount_due * 100)::integer then raise exception 'STRIPE_AMOUNT_MISMATCH'; end if;
    if v_order.payment_status not in ('paid', 'refunded') then
      update public.orders set
        payment_status = 'paid', stripe_payment_intent_id = coalesce(p_payment_intent_id, stripe_payment_intent_id),
        status = case when status = 'Pending Payment' then 'New' else status end
      where id = v_order.id;
      update public.payments set
        status = 'paid', provider_payment_id = coalesce(p_payment_intent_id, provider_payment_id), paid_at = now()
      where order_id = v_order.id and provider = 'stripe';
      update public.loyalty_rewards set status = 'redeemed', redeemed_at = now(), updated_at = now()
      where id = v_order.loyalty_reward_id and status = 'reserved';
    end if;
  elsif p_event_type in ('checkout.session.expired', 'checkout.session.async_payment_failed') then
    if v_order.payment_status = 'pending' then
      select * into v_benefits from public.restore_order_benefits(v_order.id, null);
      update public.orders set
        payment_status = case when p_event_type = 'checkout.session.expired' then 'expired' else 'failed' end,
        status = 'Cancelled'
      where id = v_order.id;
      update public.payments set
        status = case when p_event_type = 'checkout.session.expired' then 'expired' else 'failed' end
      where order_id = v_order.id and provider = 'stripe';
    end if;
  elsif p_event_type = 'charge.refunded' then
    if v_order.payment_status <> 'refunded' then
      select * into v_benefits from public.restore_order_benefits(v_order.id, null);
      update public.orders set payment_status = 'refunded', status = 'Cancelled' where id = v_order.id;
      update public.payments set status = 'refunded', refunded_at = now()
      where order_id = v_order.id and provider = 'stripe';
    end if;
  end if;

  return query select true, v_order.order_number, v_order.id;
end;
$$;

create or replace function public.fulfill_gift_card_sale(
  p_event_id text,
  p_event_type text,
  p_session_id text,
  p_payment_intent_id text,
  p_amount_cents integer
)
returns table (processed boolean, sale_id uuid, gift_card_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale public.gift_card_sales%rowtype;
  v_gift_card_id uuid;
begin
  insert into public.stripe_webhook_events (event_id, event_type, object_id)
  values (p_event_id, p_event_type, coalesce(p_session_id, p_payment_intent_id, ''))
  on conflict (event_id) do nothing;
  if not found then
    select * into v_sale from public.gift_card_sales
    where stripe_checkout_session_id = p_session_id or stripe_payment_intent_id = p_payment_intent_id
    limit 1;
    return query select false, v_sale.id, v_sale.gift_card_id;
    return;
  end if;

  select * into v_sale from public.gift_card_sales
  where stripe_checkout_session_id = p_session_id or
        (p_payment_intent_id is not null and stripe_payment_intent_id = p_payment_intent_id)
  for update;
  if not found then raise exception 'GIFT_CARD_SALE_NOT_FOUND'; end if;

  if p_event_type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded') then
    if p_amount_cents <> round(v_sale.amount * 100)::integer then raise exception 'STRIPE_AMOUNT_MISMATCH'; end if;
    if v_sale.status = 'pending' then
      insert into public.gift_cards (
        code_hash, code_last_four, code_ciphertext, initial_balance, balance,
        recipient_name, recipient_email, note, owner_profile_id, source
      ) values (
        v_sale.pending_code_hash, v_sale.pending_code_last_four,
        v_sale.pending_code_ciphertext, v_sale.amount, v_sale.amount,
        v_sale.recipient_name, v_sale.recipient_email, v_sale.personal_message,
        v_sale.purchaser_profile_id, 'online'
      ) returning id into v_gift_card_id;

      insert into public.gift_card_transactions (
        gift_card_id, transaction_type, amount, balance_after, note
      ) values (v_gift_card_id, 'issue', v_sale.amount, v_sale.amount, 'Paid online Gift Card purchase');

      update public.gift_card_sales set
        status = 'paid', gift_card_id = v_gift_card_id,
        stripe_payment_intent_id = coalesce(p_payment_intent_id, stripe_payment_intent_id),
        paid_at = now()
      where id = v_sale.id;
      update public.gift_cards set sale_id = v_sale.id where id = v_gift_card_id;
    else
      v_gift_card_id := v_sale.gift_card_id;
    end if;
  elsif p_event_type in ('checkout.session.expired', 'checkout.session.async_payment_failed') then
    if v_sale.status = 'pending' then
      update public.gift_card_sales set
        status = case when p_event_type = 'checkout.session.expired' then 'expired' else 'failed' end,
        delivery_status = 'failed'
      where id = v_sale.id;
    end if;
    v_gift_card_id := v_sale.gift_card_id;
  elsif p_event_type = 'charge.refunded' then
    v_gift_card_id := v_sale.gift_card_id;
    if v_gift_card_id is not null and exists (
      select 1 from public.gift_cards where id = v_gift_card_id and balance = initial_balance
    ) then
      update public.gift_cards set status = 'disabled' where id = v_gift_card_id;
      update public.gift_card_sales set status = 'refunded', refunded_at = now() where id = v_sale.id;
    else
      update public.gift_card_sales set status = 'refund_review' where id = v_sale.id;
    end if;
  end if;

  return query select true, v_sale.id, v_gift_card_id;
end;
$$;

create or replace function public.sync_customer_profile_orders(p_customer_profile_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_profile public.customer_profiles%rowtype;
  v_user auth.users%rowtype;
  v_order record;
  v_count integer := 0;
begin
  select * into v_profile from public.customer_profiles where id = p_customer_profile_id for update;
  if not found then raise exception 'CUSTOMER_PROFILE_NOT_FOUND'; end if;
  select * into v_user from auth.users where id = v_profile.auth_user_id;
  if not found or v_user.email_confirmed_at is null then return 0; end if;

  update public.customer_profiles set
    email = lower(v_user.email), email_verified_at = v_user.email_confirmed_at
  where id = v_profile.id;

  update public.orders set customer_profile_id = v_profile.id
  where customer_profile_id is null and email is not null
    and lower(email) = lower(v_user.email);
  get diagnostics v_count = row_count;

  for v_order in
    select id from public.orders
    where customer_profile_id = v_profile.id and status = 'Completed'
  loop
    perform public.apply_loyalty_for_order(v_order.id);
  end loop;
  return v_count;
end;
$$;

create or replace function public.issue_gift_card_v3(
  p_code_hash text, p_code_last_four text, p_code_ciphertext text,
  p_amount numeric, p_recipient_name text, p_recipient_email text,
  p_note text, p_expires_on date, p_tender_type text,
  p_receipt_reference text, p_created_by uuid, p_purchaser_email text
)
returns table (gift_card_id uuid, sale_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_amount numeric(10,2) := round(p_amount, 2);
  v_sale_id uuid;
  v_card_id uuid;
  v_source text;
begin
  if length(p_code_hash) <> 64 or length(p_code_last_four) <> 4 or length(p_code_ciphertext) < 20 then raise exception 'INVALID_GIFT_CARD_CODE'; end if;
  if v_amount < 5 or v_amount > 1000 then raise exception 'INVALID_GIFT_CARD_AMOUNT'; end if;
  if p_tender_type not in ('cash', 'card_terminal', 'complimentary') then raise exception 'INVALID_TENDER'; end if;
  if p_tender_type <> 'complimentary' and length(trim(coalesce(p_receipt_reference, ''))) < 2 then raise exception 'RECEIPT_REQUIRED'; end if;
  if p_expires_on is not null and p_expires_on < current_date then raise exception 'INVALID_EXPIRY'; end if;
  v_source := case when p_tender_type = 'complimentary' then 'complimentary' else 'in_store' end;
  insert into public.gift_card_sales (
    purchaser_email, recipient_name, recipient_email, personal_message, amount,
    sales_channel, status, tender_type, receipt_reference, pending_code_hash,
    pending_code_last_four, pending_code_ciphertext, delivery_status, paid_at, created_by
  ) values (
    lower(left(coalesce(p_purchaser_email, ''), 254)), left(coalesce(p_recipient_name, ''), 120),
    lower(left(coalesce(p_recipient_email, ''), 254)), left(coalesce(p_note, ''), 500), v_amount,
    v_source, 'paid', p_tender_type, left(coalesce(p_receipt_reference, ''), 120),
    p_code_hash, p_code_last_four, p_code_ciphertext, 'manual_required', now(), p_created_by
  ) returning id into v_sale_id;
  insert into public.gift_cards (
    code_hash, code_last_four, code_ciphertext, initial_balance, balance,
    recipient_name, recipient_email, note, expires_on, issued_by, sale_id, source
  ) values (
    p_code_hash, p_code_last_four, p_code_ciphertext, v_amount, v_amount,
    left(coalesce(p_recipient_name, ''), 120), nullif(lower(left(coalesce(p_recipient_email, ''), 254)), ''),
    left(coalesce(p_note, ''), 1000), p_expires_on, p_created_by, v_sale_id, v_source
  ) returning id into v_card_id;
  insert into public.gift_card_transactions (gift_card_id, transaction_type, amount, balance_after, created_by, note)
  values (v_card_id, 'issue', v_amount, v_amount, p_created_by, 'Created with verified ' || p_tender_type || ' tender');
  update public.gift_card_sales set gift_card_id = v_card_id where id = v_sale_id;
  return query select v_card_id, v_sale_id;
end;
$$;

alter table public.customer_profiles enable row level security;
alter table public.payments enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.gift_card_sales enable row level security;
alter table public.loyalty_rules enable row level security;
alter table public.loyalty_progress enable row level security;
alter table public.loyalty_rewards enable row level security;
alter table public.loyalty_ledger enable row level security;

revoke all on public.customer_profiles from anon, authenticated;
revoke all on public.payments from anon, authenticated;
revoke all on public.stripe_webhook_events from anon, authenticated;
revoke all on public.gift_card_sales from anon, authenticated;
revoke all on public.loyalty_rules from anon, authenticated;
revoke all on public.loyalty_progress from anon, authenticated;
revoke all on public.loyalty_rewards from anon, authenticated;
revoke all on public.loyalty_ledger from anon, authenticated;

grant all on public.customer_profiles to service_role;
grant all on public.payments to service_role;
grant all on public.stripe_webhook_events to service_role;
grant all on public.gift_card_sales to service_role;
grant all on public.loyalty_rules to service_role;
grant all on public.loyalty_progress to service_role;
grant all on public.loyalty_rewards to service_role;
grant all on public.loyalty_ledger to service_role;

revoke all on function public.apply_loyalty_for_order(uuid) from public;
revoke all on function public.reverse_loyalty_for_order(uuid) from public;
revoke all on function public.restore_order_benefits(uuid, uuid) from public;
revoke all on function public.create_checkout_order_v3(
  text, text, text, text, text, text, text, text, text, text, text, text,
  numeric, numeric, numeric, numeric, text, jsonb, text, uuid, text, uuid
) from public;
revoke all on function public.update_order_status_v3(text, text, uuid, boolean) from public;
revoke all on function public.process_stripe_order_event(text, text, text, text, integer) from public;
revoke all on function public.fulfill_gift_card_sale(text, text, text, text, integer) from public;
revoke all on function public.sync_customer_profile_orders(uuid) from public;
revoke all on function public.issue_gift_card_v3(text, text, text, numeric, text, text, text, date, text, text, uuid, text) from public;

grant execute on function public.create_checkout_order_v3(
  text, text, text, text, text, text, text, text, text, text, text, text,
  numeric, numeric, numeric, numeric, text, jsonb, text, uuid, text, uuid
) to service_role;
grant execute on function public.update_order_status_v3(text, text, uuid, boolean) to service_role;
grant execute on function public.process_stripe_order_event(text, text, text, text, integer) to service_role;
grant execute on function public.fulfill_gift_card_sale(text, text, text, text, integer) to service_role;
grant execute on function public.sync_customer_profile_orders(uuid) to service_role;
grant execute on function public.issue_gift_card_v3(text, text, text, numeric, text, text, text, date, text, text, uuid, text) to service_role;

comment on table public.customer_profiles is
  'Verified customer accounts with stable printable membership numbers.';
comment on table public.payments is
  'Payment attempts and final state; Stripe is authoritative for online card payments.';
comment on table public.loyalty_rules is
  'Owner/Manager-defined product quantity campaigns with free product or physical gift rewards.';
comment on table public.loyalty_ledger is
  'Idempotent loyalty earning and reversal ledger based only on completed orders.';
comment on table public.loyalty_rewards is
  'Individually redeemable rewards issued when a member crosses a configured rule threshold.';
