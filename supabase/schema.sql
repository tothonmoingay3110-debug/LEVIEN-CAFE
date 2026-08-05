-- LEVIEN CAFE — Sprint 5.1 Supabase Foundation
-- Single-store schema. Local Storage remains active until later migration sprints.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.site_content (
  id uuid primary key default gen_random_uuid(),
  singleton_key text unique not null default 'main',
  store_name text not null default 'LEVIEN CAFE',
  tagline text not null default 'CAFE & EATERY',
  logo_url text,
  announcement text,
  about_title text,
  about_text text,
  about_image_url text,
  address text,
  phone text,
  email text,
  opening_hours text,
  map_url text,
  footer_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  icon text not null default '☕',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.toppings (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  price numeric(10,2) not null default 0 check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(10,2) not null default 0 check (price >= 0),
  image_url text,
  emoji text not null default '☕',
  allow_ice boolean not null default true,
  allow_sugar boolean not null default true,
  allow_toppings boolean not null default false,
  best_seller boolean not null default false,
  must_try boolean not null default false,
  featured boolean not null default false,
  is_new boolean not null default false,
  sold_out boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_toppings (
  product_id uuid not null references public.products(id) on delete cascade,
  topping_id uuid not null references public.toppings(id) on delete cascade,
  primary key (product_id, topping_id)
);

create table if not exists public.combos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null default 0 check (price >= 0),
  image_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.combo_products (
  combo_id uuid not null references public.combos(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  position integer not null default 0,
  primary key (combo_id, product_id)
);

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  eyebrow text,
  description text,
  price_text text,
  image_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  phone_normalized text unique not null check (length(phone_normalized) between 10 and 15),
  phone_display text not null,
  first_name text not null,
  last_name text not null,
  email text,
  first_order_at timestamptz,
  last_order_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  customer_id uuid references public.customers(id) on delete set null,
  first_name text not null,
  last_name text not null,
  phone text not null,
  phone_normalized text not null,
  email text,
  fulfillment_type text not null check (fulfillment_type in ('Pickup', 'Delivery')),
  pickup_time text,
  address text,
  city text,
  zip text,
  apartment text,
  payment_method text not null default 'Pay at Store',
  subtotal numeric(10,2) not null default 0 check (subtotal >= 0),
  tax numeric(10,2) not null default 0 check (tax >= 0),
  delivery_fee numeric(10,2) not null default 0 check (delivery_fee >= 0),
  total numeric(10,2) not null default 0 check (total >= 0),
  status text not null default 'New' check (status in ('New', 'Preparing', 'Ready', 'Completed', 'Cancelled')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  line_id text not null,
  item_type text not null default 'product' check (item_type in ('product', 'combo')),
  product_id uuid references public.products(id) on delete set null,
  combo_id uuid references public.combos(id) on delete set null,
  name text not null,
  emoji text not null default '☕',
  base_price numeric(10,2) not null default 0 check (base_price >= 0),
  unit_price numeric(10,2) not null default 0 check (unit_price >= 0),
  quantity integer not null default 1 check (quantity > 0),
  ice text,
  sugar text,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (order_id, line_id)
);

create table if not exists public.order_item_toppings (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  topping_id uuid references public.toppings(id) on delete set null,
  topping_name text not null,
  topping_price numeric(10,2) not null default 0 check (topping_price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.order_combo_items (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  emoji text not null default '☕',
  position integer not null default 0,
  ice text,
  sugar text,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.order_combo_item_toppings (
  id uuid primary key default gen_random_uuid(),
  order_combo_item_id uuid not null references public.order_combo_items(id) on delete cascade,
  topping_id uuid references public.toppings(id) on delete set null,
  topping_name text not null,
  topping_price numeric(10,2) not null default 0 check (topping_price >= 0),
  created_at timestamptz not null default now()
);

create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists products_active_sort_idx on public.products(active, sort_order);
create index if not exists combos_active_sort_idx on public.combos(active, sort_order);
create index if not exists promotions_active_sort_idx on public.promotions(active, sort_order);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_status_created_at_idx on public.orders(status, created_at desc);
create index if not exists orders_phone_normalized_idx on public.orders(phone_normalized);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_combo_items_order_item_id_idx on public.order_combo_items(order_item_id);

-- Maintain updated_at consistently.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'site_content', 'categories', 'toppings', 'products', 'combos',
    'promotions', 'customers', 'orders'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name
    );
  end loop;
end;
$$;

insert into public.site_content (
  singleton_key,
  store_name,
  tagline,
  announcement,
  address,
  phone,
  opening_hours,
  footer_text
)
values (
  'main',
  'LEVIEN CAFE',
  'CAFE & EATERY',
  'Fresh Vietnamese coffee and bánh mì every day.',
  '600 Washington Ave Unit 18C, Philadelphia, PA',
  '+1 215-305-4047',
  'Open daily • 7 AM – 9 PM',
  'Made with care in Philadelphia'
)
on conflict (singleton_key) do nothing;

-- RLS is mandatory because these tables are exposed through the Data API.
alter table public.site_content enable row level security;
alter table public.categories enable row level security;
alter table public.toppings enable row level security;
alter table public.products enable row level security;
alter table public.product_toppings enable row level security;
alter table public.combos enable row level security;
alter table public.combo_products enable row level security;
alter table public.promotions enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_toppings enable row level security;
alter table public.order_combo_items enable row level security;
alter table public.order_combo_item_toppings enable row level security;

-- Public storefront may only read active catalog/content data in Sprint 5.1.
drop policy if exists "Public can read site content" on public.site_content;
create policy "Public can read site content"
on public.site_content for select to anon, authenticated
using (true);

drop policy if exists "Public can read active categories" on public.categories;
create policy "Public can read active categories"
on public.categories for select to anon, authenticated
using (active = true);

drop policy if exists "Public can read active toppings" on public.toppings;
create policy "Public can read active toppings"
on public.toppings for select to anon, authenticated
using (active = true);

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
on public.products for select to anon, authenticated
using (active = true);

drop policy if exists "Public can read product topping links" on public.product_toppings;
create policy "Public can read product topping links"
on public.product_toppings for select to anon, authenticated
using (true);

drop policy if exists "Public can read active combos" on public.combos;
create policy "Public can read active combos"
on public.combos for select to anon, authenticated
using (active = true);

drop policy if exists "Public can read combo product links" on public.combo_products;
create policy "Public can read combo product links"
on public.combo_products for select to anon, authenticated
using (true);

drop policy if exists "Public can read active promotions" on public.promotions;
create policy "Public can read active promotions"
on public.promotions for select to anon, authenticated
using (active = true);

-- Operational data intentionally has no browser policies yet.
-- Orders/customers will be written through secure server routes in Sprint 5.3.

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
  if length(p_phone_normalized) not between 10 and 15 then raise exception 'Invalid phone number'; end if;
  if p_fulfillment_type not in ('Pickup', 'Delivery') then raise exception 'Invalid fulfillment type'; end if;
  if least(p_subtotal, p_tax, p_delivery_fee, p_total) < 0 then raise exception 'Order amounts cannot be negative'; end if;

  insert into public.customers (
    phone_normalized, phone_display, first_name, last_name, email, first_order_at, last_order_at
  ) values (
    p_phone_normalized, p_phone, p_first_name, p_last_name, nullif(p_email, ''), v_now, v_now
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
  select v_prefix || lpad((count(*) + 1)::text, 3, '0') into v_order_number
  from public.orders where orders.order_number like v_prefix || '%';

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

grant usage on schema public to anon, authenticated;
grant select on public.site_content, public.categories, public.toppings,
  public.products, public.product_toppings, public.combos,
  public.combo_products, public.promotions to anon, authenticated;
