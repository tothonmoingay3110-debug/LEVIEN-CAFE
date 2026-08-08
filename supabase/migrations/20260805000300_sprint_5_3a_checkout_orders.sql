create or replace function public.create_checkout_order(
  p_first_name text, p_last_name text, p_phone text, p_phone_normalized text,
  p_email text, p_fulfillment_type text, p_pickup_time text, p_address text,
  p_city text, p_zip text, p_apartment text, p_payment_method text,
  p_subtotal numeric, p_tax numeric, p_delivery_fee numeric, p_total numeric,
  p_note text
)
returns table (order_number text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer_id uuid;
  v_now timestamptz := now();
  v_prefix text := 'LV' || to_char(current_date, 'YYMMDD');
  v_order_number text;
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
  );

  return query select v_order_number;
end;
$$;

revoke all on function public.create_checkout_order(
  text, text, text, text, text, text, text, text, text, text, text, text,
  numeric, numeric, numeric, numeric, text
) from public;

grant execute on function public.create_checkout_order(
  text, text, text, text, text, text, text, text, text, text, text, text,
  numeric, numeric, numeric, numeric, text
) to service_role;
