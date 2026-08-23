-- Scheduled promotions and multi-product loyalty rules.
-- Existing single-product rules are preserved as the first configured option.

alter table public.promotions
add column if not exists starts_on date not null default current_date;

alter table public.promotions
add column if not exists ends_on date;

alter table public.promotions
drop constraint if exists promotions_dates_valid;

alter table public.promotions
add constraint promotions_dates_valid
check (ends_on is null or ends_on >= starts_on);

create index if not exists promotions_live_dates_idx
on public.promotions (active, starts_on, ends_on, sort_order);

drop policy if exists "Public can read active promotions" on public.promotions;
create policy "Public can read active promotions"
on public.promotions for select to anon, authenticated
using (
  active = true
  and starts_on <= current_date
  and (ends_on is null or ends_on >= current_date)
);

create table if not exists public.loyalty_rule_trigger_products (
  rule_id uuid not null references public.loyalty_rules(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  position integer not null default 0,
  primary key (rule_id, product_id)
);

create table if not exists public.loyalty_rule_reward_products (
  rule_id uuid not null references public.loyalty_rules(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  position integer not null default 0,
  primary key (rule_id, product_id)
);

create table if not exists public.loyalty_reward_products (
  reward_id uuid not null references public.loyalty_rewards(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  position integer not null default 0,
  primary key (reward_id, product_id)
);

alter table public.loyalty_rewards
add column if not exists redeemed_product_id uuid references public.products(id) on delete restrict;

insert into public.loyalty_rule_trigger_products (rule_id, product_id, position)
select id, trigger_product_id, 1
from public.loyalty_rules
on conflict do nothing;

insert into public.loyalty_rule_reward_products (rule_id, product_id, position)
select id, reward_product_id, 1
from public.loyalty_rules
where reward_type = 'free_product' and reward_product_id is not null
on conflict do nothing;

insert into public.loyalty_reward_products (reward_id, product_id, position)
select id, reward_product_id, 1
from public.loyalty_rewards
where reward_type = 'free_product' and reward_product_id is not null
on conflict do nothing;

create index if not exists loyalty_trigger_products_product_idx
on public.loyalty_rule_trigger_products (product_id, rule_id);

create index if not exists loyalty_rule_reward_products_product_idx
on public.loyalty_rule_reward_products (product_id, rule_id);

create index if not exists loyalty_reward_products_product_idx
on public.loyalty_reward_products (product_id, reward_id);

alter table public.loyalty_rule_trigger_products enable row level security;
alter table public.loyalty_rule_reward_products enable row level security;
alter table public.loyalty_reward_products enable row level security;

revoke all on public.loyalty_rule_trigger_products from anon, authenticated;
revoke all on public.loyalty_rule_reward_products from anon, authenticated;
revoke all on public.loyalty_reward_products from anon, authenticated;
grant all on public.loyalty_rule_trigger_products to service_role;
grant all on public.loyalty_rule_reward_products to service_role;
grant all on public.loyalty_reward_products to service_role;

create or replace function public.create_loyalty_rule_v2(
  p_name text,
  p_description text,
  p_trigger_product_ids uuid[],
  p_required_quantity integer,
  p_reward_type text,
  p_reward_product_ids uuid[],
  p_reward_name text,
  p_reward_expires_days integer,
  p_repeatable boolean,
  p_starts_on date,
  p_ends_on date,
  p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rule_id uuid;
  v_trigger_id uuid;
  v_reward_id uuid;
  v_position bigint;
begin
  if coalesce(array_length(p_trigger_product_ids, 1), 0) < 1 then
    raise exception 'LOYALTY_TRIGGER_PRODUCTS_REQUIRED';
  end if;
  if p_reward_type not in ('free_product', 'physical_gift') then
    raise exception 'LOYALTY_REWARD_TYPE_INVALID';
  end if;
  if p_reward_type = 'free_product' and coalesce(array_length(p_reward_product_ids, 1), 0) < 1 then
    raise exception 'LOYALTY_REWARD_PRODUCTS_REQUIRED';
  end if;
  if p_ends_on is not null and p_ends_on < p_starts_on then
    raise exception 'LOYALTY_DATES_INVALID';
  end if;

  v_trigger_id := p_trigger_product_ids[1];
  v_reward_id := case when p_reward_type = 'free_product' then p_reward_product_ids[1] else null end;

  insert into public.loyalty_rules (
    name, description, trigger_product_id, required_quantity, reward_type,
    reward_product_id, reward_name, reward_expires_days, repeatable,
    starts_on, ends_on, created_by
  ) values (
    p_name, p_description, v_trigger_id, p_required_quantity, p_reward_type,
    v_reward_id, p_reward_name, p_reward_expires_days, p_repeatable,
    p_starts_on, p_ends_on, p_created_by
  ) returning id into v_rule_id;

  for v_trigger_id, v_position in
    select selected.product_id, selected.position
    from unnest(p_trigger_product_ids) with ordinality as selected(product_id, position)
  loop
    insert into public.loyalty_rule_trigger_products (rule_id, product_id, position)
    values (v_rule_id, v_trigger_id, v_position)
    on conflict do nothing;
  end loop;

  if p_reward_type = 'free_product' then
    for v_reward_id, v_position in
      select selected.product_id, selected.position
      from unnest(p_reward_product_ids) with ordinality as selected(product_id, position)
    loop
      insert into public.loyalty_rule_reward_products (rule_id, product_id, position)
      values (v_rule_id, v_reward_id, v_position)
      on conflict do nothing;
    end loop;
  end if;

  return v_rule_id;
end;
$$;

revoke all on function public.create_loyalty_rule_v2(text, text, uuid[], integer, text, uuid[], text, integer, boolean, date, date, uuid) from public;
grant execute on function public.create_loyalty_rule_v2(text, text, uuid[], integer, text, uuid[], text, integer, boolean, date, date, uuid) to service_role;

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
  v_reward_id uuid;
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
      join public.loyalty_rule_trigger_products eligible
        on eligible.rule_id = v_rule.id and eligible.product_id = oi.product_id
      where oi.order_id = v_order.id
      union all
      select parent.quantity
      from public.order_combo_items child
      join public.order_items parent on parent.id = child.order_item_id
      join public.loyalty_rule_trigger_products eligible
        on eligible.rule_id = v_rule.id and eligible.product_id = child.product_id
      where parent.order_id = v_order.id
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
        ) returning id into v_reward_id;

        if v_rule.reward_type = 'free_product' then
          insert into public.loyalty_reward_products (reward_id, product_id, position)
          select v_reward_id, product_id, position
          from public.loyalty_rule_reward_products
          where rule_id = v_rule.id
          order by position;
        end if;
        v_created := v_created + 1;
      end loop;
    end if;
  end loop;

  return v_created;
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
      redeemed_by = null, redeemed_product_id = null, updated_at = now()
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
  v_reward_product_id uuid;
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

    select product.id, product.price
    into v_reward_product_id, v_reward_price
    from jsonb_array_elements(p_items) item
    join public.loyalty_reward_products eligible
      on eligible.reward_id = v_reward.id
      and eligible.product_id::text = item ->> 'productId'
    join public.products product
      on product.id = eligible.product_id and product.active = true and product.sold_out = false
    where item ->> 'itemType' = 'product'
      and coalesce((item ->> 'quantity')::integer, 0) > 0
    order by product.price desc, eligible.position
    limit 1;

    if v_reward_product_id is null then raise exception 'LOYALTY_PRODUCT_REQUIRED'; end if;
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
      redeemed_product_id = v_reward_product_id,
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

create or replace function public.save_admin_catalog(p_catalog jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
  v_link jsonb;
  v_position bigint;
  v_parent_id uuid;
  v_content jsonb := p_catalog->'content';
begin
  if jsonb_typeof(p_catalog) <> 'object'
    or jsonb_typeof(p_catalog->'categories') <> 'array'
    or jsonb_typeof(p_catalog->'toppings') <> 'array'
    or jsonb_typeof(p_catalog->'products') <> 'array'
    or jsonb_typeof(p_catalog->'combos') <> 'array'
    or jsonb_typeof(p_catalog->'promotions') <> 'array'
    or jsonb_typeof(v_content) <> 'object' then
    raise exception 'Invalid catalog payload';
  end if;

  insert into public.site_content (
    singleton_key, store_name, tagline, logo_url, announcement, about_title,
    about_text, about_image_url, address, phone, email, opening_hours, map_url, footer_text
  ) values (
    'main', coalesce(v_content->>'storeName', 'LEVIEN CAFE'), coalesce(v_content->>'tagline', 'CAFE & EATERY'),
    nullif(v_content->>'logo', ''), nullif(v_content->>'announcement', ''), nullif(v_content->>'aboutTitle', ''),
    nullif(v_content->>'aboutText', ''), nullif(v_content->>'aboutImage', ''), nullif(v_content->>'address', ''),
    nullif(v_content->>'phone', ''), nullif(v_content->>'email', ''), nullif(v_content->>'hours', ''),
    nullif(v_content->>'mapUrl', ''), nullif(v_content->>'footerText', '')
  ) on conflict (singleton_key) do update set
    store_name=excluded.store_name, tagline=excluded.tagline, logo_url=excluded.logo_url,
    announcement=excluded.announcement, about_title=excluded.about_title, about_text=excluded.about_text,
    about_image_url=excluded.about_image_url, address=excluded.address, phone=excluded.phone,
    email=excluded.email, opening_hours=excluded.opening_hours, map_url=excluded.map_url,
    footer_text=excluded.footer_text, updated_at=now();

  for v_item, v_position in select value, ordinality from jsonb_array_elements(p_catalog->'categories') with ordinality loop
    insert into public.categories (id, name, icon, active, sort_order)
    values ((v_item->>'id')::uuid, v_item->>'name', coalesce(v_item->>'icon', ''), coalesce((v_item->>'active')::boolean, true), v_position)
    on conflict (id) do update set name=excluded.name, icon=excluded.icon, active=excluded.active,
      sort_order=excluded.sort_order, updated_at=now();
  end loop;

  for v_item in select value from jsonb_array_elements(p_catalog->'toppings') loop
    insert into public.toppings (id, name, price, active)
    values ((v_item->>'id')::uuid, v_item->>'name', (v_item->>'price')::numeric, coalesce((v_item->>'active')::boolean, true))
    on conflict (id) do update set name=excluded.name, price=excluded.price, active=excluded.active, updated_at=now();
  end loop;

  for v_item, v_position in select value, ordinality from jsonb_array_elements(p_catalog->'products') with ordinality loop
    v_parent_id := (v_item->>'id')::uuid;
    insert into public.products (
      id, category_id, name, description, price, image_url, emoji, allow_ice, allow_sugar,
      allow_toppings, best_seller, must_try, featured, is_new, sold_out, active, sort_order
    ) values (
      v_parent_id, nullif(v_item->>'categoryId', '')::uuid, v_item->>'name', nullif(v_item->>'description', ''),
      (v_item->>'price')::numeric, nullif(v_item->>'image', ''), coalesce(v_item->>'emoji', ''),
      coalesce((v_item->>'allowIce')::boolean, false), coalesce((v_item->>'allowSugar')::boolean, false),
      coalesce((v_item->>'allowToppings')::boolean, false), coalesce((v_item->>'bestSeller')::boolean, false),
      coalesce((v_item->>'mustTry')::boolean, false), coalesce((v_item->>'featured')::boolean, false),
      coalesce((v_item->>'isNew')::boolean, false), coalesce((v_item->>'soldOut')::boolean, false),
      coalesce((v_item->>'active')::boolean, true), v_position
    ) on conflict (id) do update set
      category_id=excluded.category_id, name=excluded.name, description=excluded.description,
      price=excluded.price, image_url=excluded.image_url, emoji=excluded.emoji,
      allow_ice=excluded.allow_ice, allow_sugar=excluded.allow_sugar, allow_toppings=excluded.allow_toppings,
      best_seller=excluded.best_seller, must_try=excluded.must_try, featured=excluded.featured,
      is_new=excluded.is_new, sold_out=excluded.sold_out, active=excluded.active,
      sort_order=excluded.sort_order, updated_at=now();

    delete from public.product_toppings where product_id = v_parent_id;
    for v_link in select value from jsonb_array_elements(coalesce(v_item->'toppingIds', '[]'::jsonb)) loop
      insert into public.product_toppings (product_id, topping_id)
      values (v_parent_id, trim(both '"' from v_link::text)::uuid) on conflict do nothing;
    end loop;
  end loop;

  for v_item, v_position in select value, ordinality from jsonb_array_elements(p_catalog->'combos') with ordinality loop
    v_parent_id := (v_item->>'id')::uuid;
    insert into public.combos (id, name, description, price, image_url, active, sort_order)
    values (v_parent_id, v_item->>'name', nullif(v_item->>'description', ''), (v_item->>'price')::numeric,
      nullif(v_item->>'image', ''), coalesce((v_item->>'active')::boolean, true), v_position)
    on conflict (id) do update set name=excluded.name, description=excluded.description,
      price=excluded.price, image_url=excluded.image_url, active=excluded.active,
      sort_order=excluded.sort_order, updated_at=now();

    delete from public.combo_products where combo_id = v_parent_id;
    for v_link, v_position in select value, ordinality from jsonb_array_elements(coalesce(v_item->'productIds', '[]'::jsonb)) with ordinality loop
      insert into public.combo_products (combo_id, product_id, position)
      values (v_parent_id, trim(both '"' from v_link::text)::uuid, v_position) on conflict do nothing;
    end loop;
  end loop;

  for v_item, v_position in select value, ordinality from jsonb_array_elements(p_catalog->'promotions') with ordinality loop
    insert into public.promotions (
      id, name, eyebrow, description, price_text, image_url, active, sort_order,
      starts_on, ends_on
    ) values (
      (v_item->>'id')::uuid, v_item->>'title', nullif(v_item->>'eyebrow', ''),
      nullif(v_item->>'description', ''), nullif(v_item->>'priceText', ''), nullif(v_item->>'image', ''),
      coalesce((v_item->>'active')::boolean, true), coalesce((v_item->>'order')::integer, v_position::integer),
      coalesce(nullif(v_item->>'startDate', '')::date, current_date),
      nullif(v_item->>'endDate', '')::date
    ) on conflict (id) do update set name=excluded.name, eyebrow=excluded.eyebrow,
      description=excluded.description, price_text=excluded.price_text, image_url=excluded.image_url,
      active=excluded.active, sort_order=excluded.sort_order, starts_on=excluded.starts_on,
      ends_on=excluded.ends_on, updated_at=now();
  end loop;
end;
$$;

revoke all on function public.save_admin_catalog(jsonb) from public;
grant execute on function public.save_admin_catalog(jsonb) to service_role;

comment on table public.loyalty_rule_trigger_products is
  'Products whose completed-order quantities contribute toward a loyalty rule.';
comment on table public.loyalty_rule_reward_products is
  'Menu products an administrator allows a member to choose for a free-product reward.';
comment on table public.loyalty_reward_products is
  'Snapshot of allowed product choices when a member reward is issued.';
