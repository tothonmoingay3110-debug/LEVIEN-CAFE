drop function if exists public.create_checkout_order(
  text, text, text, text, text, text, text, text, text, text, text, text,
  numeric, numeric, numeric, numeric, text
);

create function public.create_checkout_order(
  p_first_name text, p_last_name text, p_phone text, p_phone_normalized text,
  p_email text, p_fulfillment_type text, p_pickup_time text, p_address text,
  p_city text, p_zip text, p_apartment text, p_payment_method text,
  p_subtotal numeric, p_tax numeric, p_delivery_fee numeric, p_total numeric,
  p_note text, p_items jsonb
)
returns table (order_number text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer_id uuid;
  v_order_id uuid;
  v_order_item_id uuid;
  v_combo_item_id uuid;
  v_now timestamptz := now();
  v_prefix text := 'LV' || to_char(current_date, 'YYMMDD');
  v_order_number text;
  v_item jsonb;
  v_topping jsonb;
  v_combo_item jsonb;
  v_item_type text;
  v_position integer;
  v_items_subtotal numeric;
begin
  if length(p_phone_normalized) not between 10 and 15 then
    raise exception 'Invalid phone number';
  end if;
  if p_fulfillment_type not in ('Pickup', 'Delivery') then
    raise exception 'Invalid fulfillment type';
  end if;
  if least(p_subtotal, p_tax, p_delivery_fee, p_total) < 0 then
    raise exception 'Order amounts cannot be negative';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order items are required';
  end if;

  select coalesce(sum((item->>'unitPrice')::numeric * (item->>'quantity')::integer), 0)
  into v_items_subtotal
  from jsonb_array_elements(p_items) as item;
  if abs(v_items_subtotal - p_subtotal) > 0.01 then
    raise exception 'Order item subtotal does not match order subtotal';
  end if;

  insert into public.customers (
    phone_normalized, phone_display, first_name, last_name, email,
    first_order_at, last_order_at
  ) values (
    p_phone_normalized, p_phone, p_first_name, p_last_name, nullif(p_email, ''),
    v_now, v_now
  )
  on conflict (phone_normalized) do update set
    phone_display = excluded.phone_display,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    email = coalesce(excluded.email, customers.email),
    last_order_at = v_now,
    updated_at = v_now
  returning id into v_customer_id;

  perform pg_advisory_xact_lock(hashtext(v_prefix));
  select v_prefix || lpad((count(*) + 1)::text, 3, '0')
  into v_order_number
  from public.orders
  where orders.order_number like v_prefix || '%';

  insert into public.orders (
    order_number, customer_id, first_name, last_name, phone, phone_normalized,
    email, fulfillment_type, pickup_time, address, city, zip, apartment,
    payment_method, subtotal, tax, delivery_fee, total, status, note
  ) values (
    v_order_number, v_customer_id, p_first_name, p_last_name, p_phone, p_phone_normalized,
    nullif(p_email, ''), p_fulfillment_type, nullif(p_pickup_time, ''),
    nullif(p_address, ''), nullif(p_city, ''), nullif(p_zip, ''), nullif(p_apartment, ''),
    p_payment_method, p_subtotal, p_tax, p_delivery_fee, p_total, 'New', coalesce(p_note, '')
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_item_type := coalesce(nullif(v_item->>'itemType', ''), 'product');
    if v_item_type not in ('product', 'combo') then
      raise exception 'Invalid order item type';
    end if;

    insert into public.order_items (
      order_id, line_id, item_type, product_id, combo_id, name, emoji,
      base_price, unit_price, quantity, ice, sugar, note
    ) values (
      v_order_id,
      v_item->>'lineId',
      v_item_type,
      case when v_item_type = 'product' then (v_item->>'productId')::uuid else null end,
      case when v_item_type = 'combo' then (v_item->>'comboId')::uuid else null end,
      v_item->>'name',
      coalesce(v_item->>'emoji', ''),
      (v_item->>'basePrice')::numeric,
      (v_item->>'unitPrice')::numeric,
      (v_item->>'quantity')::integer,
      nullif(v_item->>'ice', ''),
      nullif(v_item->>'sugar', ''),
      coalesce(v_item->>'note', '')
    ) returning id into v_order_item_id;

    for v_topping in
      select value from jsonb_array_elements(coalesce(v_item->'toppings', '[]'::jsonb))
    loop
      insert into public.order_item_toppings (
        order_item_id, topping_id, topping_name, topping_price
      ) values (
        v_order_item_id, (v_topping->>'id')::uuid, v_topping->>'name',
        (v_topping->>'price')::numeric
      );
    end loop;

    if v_item_type = 'combo' then
      v_position := 0;
      for v_combo_item in
        select value from jsonb_array_elements(coalesce(v_item->'comboItems', '[]'::jsonb))
      loop
        v_position := v_position + 1;
        insert into public.order_combo_items (
          order_item_id, product_id, name, emoji, position, ice, sugar, note
        ) values (
          v_order_item_id,
          (v_combo_item->>'productId')::uuid,
          v_combo_item->>'name',
          coalesce(v_combo_item->>'emoji', ''),
          v_position,
          nullif(v_combo_item->>'ice', ''),
          nullif(v_combo_item->>'sugar', ''),
          coalesce(v_combo_item->>'note', '')
        ) returning id into v_combo_item_id;

        for v_topping in
          select value from jsonb_array_elements(coalesce(v_combo_item->'toppings', '[]'::jsonb))
        loop
          insert into public.order_combo_item_toppings (
            order_combo_item_id, topping_id, topping_name, topping_price
          ) values (
            v_combo_item_id, (v_topping->>'id')::uuid, v_topping->>'name',
            (v_topping->>'price')::numeric
          );
        end loop;
      end loop;
    end if;
  end loop;

  return query select v_order_number;
end;
$$;

revoke all on function public.create_checkout_order(
  text, text, text, text, text, text, text, text, text, text, text, text,
  numeric, numeric, numeric, numeric, text, jsonb
) from public;

grant execute on function public.create_checkout_order(
  text, text, text, text, text, text, text, text, text, text, text, text,
  numeric, numeric, numeric, numeric, text, jsonb
) to service_role;
