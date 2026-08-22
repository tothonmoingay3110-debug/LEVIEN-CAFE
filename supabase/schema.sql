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

-- Sprint 5.5B: secure server streams consume order change events.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'orders'
    )
  then
    alter publication supabase_realtime add table public.orders;
  end if;
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
  p_note text, p_items jsonb
)
returns table (order_number text)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_customer_id uuid; v_order_id uuid; v_order_item_id uuid; v_combo_item_id uuid;
  v_now timestamptz := now();
  v_prefix text := 'LV' || to_char(current_date, 'YYMMDD');
  v_order_number text; v_item jsonb; v_topping jsonb; v_combo_item jsonb;
  v_item_type text; v_position integer; v_items_subtotal numeric;
begin
  if length(p_phone_normalized) not between 10 and 15 then raise exception 'Invalid phone number'; end if;
  if p_fulfillment_type not in ('Pickup', 'Delivery') then raise exception 'Invalid fulfillment type'; end if;
  if least(p_subtotal, p_tax, p_delivery_fee, p_total) < 0 then raise exception 'Order amounts cannot be negative'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Order items are required'; end if;

  select coalesce(sum((item->>'unitPrice')::numeric * (item->>'quantity')::integer), 0)
  into v_items_subtotal from jsonb_array_elements(p_items) as item;
  if abs(v_items_subtotal - p_subtotal) > 0.01 then raise exception 'Order item subtotal does not match order subtotal'; end if;

  insert into public.customers (
    phone_normalized, phone_display, first_name, last_name, email, first_order_at, last_order_at
  ) values (
    p_phone_normalized, p_phone, p_first_name, p_last_name, nullif(p_email, ''), v_now, v_now
  ) on conflict (phone_normalized) do update set
    phone_display=excluded.phone_display, first_name=excluded.first_name,
    last_name=excluded.last_name, email=coalesce(excluded.email, customers.email),
    last_order_at=v_now, updated_at=v_now
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
    nullif(p_email, ''), p_fulfillment_type, nullif(p_pickup_time, ''), nullif(p_address, ''),
    nullif(p_city, ''), nullif(p_zip, ''), nullif(p_apartment, ''), p_payment_method,
    p_subtotal, p_tax, p_delivery_fee, p_total, 'New', coalesce(p_note, '')
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_item_type := coalesce(nullif(v_item->>'itemType', ''), 'product');
    if v_item_type not in ('product', 'combo') then raise exception 'Invalid order item type'; end if;
    insert into public.order_items (
      order_id, line_id, item_type, product_id, combo_id, name, emoji,
      base_price, unit_price, quantity, ice, sugar, note
    ) values (
      v_order_id, v_item->>'lineId', v_item_type,
      case when v_item_type='product' then (v_item->>'productId')::uuid else null end,
      case when v_item_type='combo' then (v_item->>'comboId')::uuid else null end,
      v_item->>'name', coalesce(v_item->>'emoji', ''), (v_item->>'basePrice')::numeric,
      (v_item->>'unitPrice')::numeric, (v_item->>'quantity')::integer,
      nullif(v_item->>'ice', ''), nullif(v_item->>'sugar', ''), coalesce(v_item->>'note', '')
    ) returning id into v_order_item_id;

    for v_topping in select value from jsonb_array_elements(coalesce(v_item->'toppings', '[]'::jsonb)) loop
      insert into public.order_item_toppings (order_item_id, topping_id, topping_name, topping_price)
      values (v_order_item_id, (v_topping->>'id')::uuid, v_topping->>'name', (v_topping->>'price')::numeric);
    end loop;

    if v_item_type='combo' then
      v_position := 0;
      for v_combo_item in select value from jsonb_array_elements(coalesce(v_item->'comboItems', '[]'::jsonb)) loop
        v_position := v_position + 1;
        insert into public.order_combo_items (order_item_id, product_id, name, emoji, position, ice, sugar, note)
        values (v_order_item_id, (v_combo_item->>'productId')::uuid, v_combo_item->>'name',
          coalesce(v_combo_item->>'emoji', ''), v_position, nullif(v_combo_item->>'ice', ''),
          nullif(v_combo_item->>'sugar', ''), coalesce(v_combo_item->>'note', ''))
        returning id into v_combo_item_id;
        for v_topping in select value from jsonb_array_elements(coalesce(v_combo_item->'toppings', '[]'::jsonb)) loop
          insert into public.order_combo_item_toppings (order_combo_item_id, topping_id, topping_name, topping_price)
          values (v_combo_item_id, (v_topping->>'id')::uuid, v_topping->>'name', (v_topping->>'price')::numeric);
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

create or replace function public.save_admin_catalog(p_catalog jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_item jsonb; v_link jsonb; v_position bigint; v_parent_id uuid;
  v_content jsonb := p_catalog->'content';
begin
  if jsonb_typeof(p_catalog) <> 'object'
    or jsonb_typeof(p_catalog->'categories') <> 'array'
    or jsonb_typeof(p_catalog->'toppings') <> 'array'
    or jsonb_typeof(p_catalog->'products') <> 'array'
    or jsonb_typeof(p_catalog->'combos') <> 'array'
    or jsonb_typeof(p_catalog->'promotions') <> 'array'
    or jsonb_typeof(v_content) <> 'object' then raise exception 'Invalid catalog payload'; end if;

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
    delete from public.product_toppings where product_id=v_parent_id;
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
    delete from public.combo_products where combo_id=v_parent_id;
    for v_link, v_position in select value, ordinality from jsonb_array_elements(coalesce(v_item->'productIds', '[]'::jsonb)) with ordinality loop
      insert into public.combo_products (combo_id, product_id, position)
      values (v_parent_id, trim(both '"' from v_link::text)::uuid, v_position) on conflict do nothing;
    end loop;
  end loop;

  for v_item, v_position in select value, ordinality from jsonb_array_elements(p_catalog->'promotions') with ordinality loop
    insert into public.promotions (id, name, eyebrow, description, price_text, image_url, active, sort_order)
    values ((v_item->>'id')::uuid, v_item->>'title', nullif(v_item->>'eyebrow', ''),
      nullif(v_item->>'description', ''), nullif(v_item->>'priceText', ''), nullif(v_item->>'image', ''),
      coalesce((v_item->>'active')::boolean, true), coalesce((v_item->>'order')::integer, v_position::integer))
    on conflict (id) do update set name=excluded.name, eyebrow=excluded.eyebrow,
      description=excluded.description, price_text=excluded.price_text, image_url=excluded.image_url,
      active=excluded.active, sort_order=excluded.sort_order, updated_at=now();
  end loop;
end;
$$;

revoke all on function public.save_admin_catalog(jsonb) from public;
grant execute on function public.save_admin_catalog(jsonb) to service_role;

grant usage on schema public to anon, authenticated;
grant select on public.site_content, public.categories, public.toppings,
  public.products, public.product_toppings, public.combos,
  public.combo_products, public.promotions to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog-images', 'catalog-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public=excluded.public,
  file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Public can read catalog images" on storage.objects;
create policy "Public can read catalog images" on storage.objects for select to public
using (bucket_id = 'catalog-images');

-- Sprint 5.5A: broadcast public catalog/content changes to open storefronts.
do $$
declare
  catalog_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach catalog_table in array array[
      'site_content',
      'categories',
      'toppings',
      'products',
      'product_toppings',
      'combos',
      'combo_products',
      'promotions'
    ]
    loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = catalog_table
      ) then
        execute format(
          'alter publication supabase_realtime add table public.%I',
          catalog_table
        );
      end if;
    end loop;
  end if;
end;
$$;

-- Sprint 5.6A: restrict browser roles to the public catalog surface only.
revoke all on public.customers, public.orders, public.order_items,
  public.order_item_toppings, public.order_combo_items,
  public.order_combo_item_toppings from anon, authenticated;

revoke insert, update, delete, truncate, references, trigger
on public.site_content, public.categories, public.toppings,
  public.products, public.product_toppings, public.combos,
  public.combo_products, public.promotions from anon, authenticated;

grant select on public.site_content, public.categories, public.toppings,
  public.products, public.product_toppings, public.combos,
  public.combo_products, public.promotions to anon, authenticated;

revoke execute on function public.create_checkout_order(
  text, text, text, text, text, text, text, text, text, text, text, text,
  numeric, numeric, numeric, numeric, text, jsonb
) from anon, authenticated;

revoke execute on function public.save_admin_catalog(jsonb)
from anon, authenticated;

drop policy if exists "Public can read product topping links" on public.product_toppings;
create policy "Public can read product topping links"
on public.product_toppings for select to anon, authenticated
using (
  exists (
    select 1 from public.products
    where products.id = product_toppings.product_id
      and products.active = true
  )
  and exists (
    select 1 from public.toppings
    where toppings.id = product_toppings.topping_id
      and toppings.active = true
  )
);

drop policy if exists "Public can read combo product links" on public.combo_products;
create policy "Public can read combo product links"
on public.combo_products for select to anon, authenticated
using (
  exists (
    select 1 from public.combos
    where combos.id = combo_products.combo_id
      and combos.active = true
  )
  and exists (
    select 1 from public.products
    where products.id = combo_products.product_id
      and products.active = true
  )
);

-- V2.1A: individual staff identities and role-based access control.
do $$
begin
  create type public.staff_role as enum ('owner', 'manager', 'supervisor', 'staff');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role public.staff_role not null default 'staff',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_profiles_email_not_blank check (length(trim(email)) > 3),
  constraint staff_profiles_full_name_not_blank check (length(trim(full_name)) > 0)
);

create unique index if not exists staff_profiles_email_unique
on public.staff_profiles (lower(email));

drop trigger if exists set_updated_at on public.staff_profiles;
create trigger set_updated_at
before update on public.staff_profiles
for each row execute function public.set_updated_at();

alter table public.staff_profiles enable row level security;
revoke all on public.staff_profiles from anon, authenticated;
grant select on public.staff_profiles to authenticated;
grant all on public.staff_profiles to service_role;

drop policy if exists "Staff can read their own active profile" on public.staff_profiles;
create policy "Staff can read their own active profile"
on public.staff_profiles for select to authenticated
using ((select auth.uid()) = auth_user_id and active = true);

comment on table public.staff_profiles is
  'Staff identity and application role. Compensation is intentionally stored separately in V2.1B.';

-- V2.1B: employee management and manager-only compensation data.
alter table public.staff_profiles
  add column if not exists phone text not null default '',
  add column if not exists must_change_password boolean not null default false;

create table if not exists public.staff_compensation (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null unique references public.staff_profiles(id) on delete cascade,
  hourly_rate numeric(10,2) not null default 0,
  weekly_hours numeric(5,2) not null default 0,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_compensation_hourly_rate_valid check (hourly_rate >= 0 and hourly_rate <= 10000),
  constraint staff_compensation_weekly_hours_valid check (weekly_hours >= 0 and weekly_hours <= 168),
  constraint staff_compensation_currency_valid check (currency ~ '^[A-Z]{3}$')
);

drop trigger if exists set_updated_at on public.staff_compensation;
create trigger set_updated_at
before update on public.staff_compensation
for each row execute function public.set_updated_at();

alter table public.staff_compensation enable row level security;
revoke all on public.staff_compensation from anon, authenticated;
grant all on public.staff_compensation to service_role;

comment on table public.staff_compensation is
  'Manager-only hourly rate and planned weekly hours. Never return through general staff sessions.';

-- V2.2: employee shift requests and manager-published work schedules.
do $$
begin
  create type public.shift_request_status as enum ('pending', 'approved', 'declined', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.work_shift_status as enum ('scheduled', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.staff_shift_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  note text not null default '',
  status public.shift_request_status not null default 'pending',
  reviewed_by uuid references public.staff_profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_shift_requests_time_valid check (end_time > start_time),
  constraint staff_shift_requests_note_length check (length(note) <= 500)
);

create table if not exists public.staff_shifts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  position text not null default '',
  note text not null default '',
  status public.work_shift_status not null default 'scheduled',
  source_request_id uuid unique references public.staff_shift_requests(id) on delete set null,
  created_by uuid references public.staff_profiles(id) on delete set null,
  updated_by uuid references public.staff_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_shifts_time_valid check (end_time > start_time),
  constraint staff_shifts_position_length check (length(position) <= 80),
  constraint staff_shifts_note_length check (length(note) <= 500)
);

create index if not exists staff_shift_requests_staff_date_idx
on public.staff_shift_requests (staff_id, shift_date);
create index if not exists staff_shift_requests_status_date_idx
on public.staff_shift_requests (status, shift_date);
create index if not exists staff_shifts_staff_date_idx
on public.staff_shifts (staff_id, shift_date);
create index if not exists staff_shifts_status_date_idx
on public.staff_shifts (status, shift_date);

drop trigger if exists set_updated_at on public.staff_shift_requests;
create trigger set_updated_at before update on public.staff_shift_requests
for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.staff_shifts;
create trigger set_updated_at before update on public.staff_shifts
for each row execute function public.set_updated_at();

alter table public.staff_shift_requests enable row level security;
alter table public.staff_shifts enable row level security;
revoke all on public.staff_shift_requests from anon, authenticated;
revoke all on public.staff_shifts from anon, authenticated;
grant all on public.staff_shift_requests to service_role;
grant all on public.staff_shifts to service_role;

comment on table public.staff_shift_requests is
  'Date-specific preferred shifts submitted by staff and reviewed by Owner or Manager.';
comment on table public.staff_shifts is
  'Published work schedule only. Attendance and clock-in are intentionally out of scope.';

-- V2.4: employee time-off requests and schedule conflict protection.
do $$
begin
  create type public.time_off_status as enum ('pending', 'approved', 'declined', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.staff_time_off_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text not null default '',
  status public.time_off_status not null default 'pending',
  reviewed_by uuid references public.staff_profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_time_off_dates_valid check (end_date >= start_date),
  constraint staff_time_off_reason_length check (length(reason) <= 500)
);

create index if not exists staff_time_off_staff_dates_idx
on public.staff_time_off_requests (staff_id, start_date, end_date);
create index if not exists staff_time_off_status_dates_idx
on public.staff_time_off_requests (status, start_date, end_date);

drop trigger if exists set_updated_at on public.staff_time_off_requests;
create trigger set_updated_at before update on public.staff_time_off_requests
for each row execute function public.set_updated_at();

alter table public.staff_time_off_requests enable row level security;
revoke all on public.staff_time_off_requests from anon, authenticated;
grant all on public.staff_time_off_requests to service_role;

comment on table public.staff_time_off_requests is
  'Employee date-range unavailability reviewed by Owner or Manager. Not a paid-leave or payroll record.';

-- V2.6-V2.11: notifications, shift coverage and operational audit history.
do $$
begin
  create type public.shift_swap_status as enum ('pending', 'approved', 'declined', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.staff_notifications (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  notification_type text not null default 'system',
  title text not null,
  message text not null default '',
  link text not null default '/admin',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint staff_notifications_type_valid check (notification_type in ('schedule', 'swap', 'time_off', 'system')),
  constraint staff_notifications_title_length check (length(title) between 1 and 120),
  constraint staff_notifications_message_length check (length(message) <= 500),
  constraint staff_notifications_link_length check (length(link) <= 200)
);

create table if not exists public.staff_shift_swap_requests (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.staff_shifts(id) on delete cascade,
  requester_id uuid not null references public.staff_profiles(id) on delete cascade,
  offered_to uuid not null references public.staff_profiles(id) on delete cascade,
  note text not null default '',
  status public.shift_swap_status not null default 'pending',
  reviewed_by uuid references public.staff_profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_shift_swap_people_different check (requester_id <> offered_to),
  constraint staff_shift_swap_note_length check (length(note) <= 500)
);

create table if not exists public.staff_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.staff_profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint staff_audit_action_length check (length(action) between 1 and 80),
  constraint staff_audit_entity_type_length check (length(entity_type) between 1 and 80),
  constraint staff_audit_summary_length check (length(summary) between 1 and 500),
  constraint staff_audit_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index if not exists staff_notifications_staff_created_idx on public.staff_notifications (staff_id, created_at desc);
create index if not exists staff_notifications_unread_idx on public.staff_notifications (staff_id, created_at desc) where read_at is null;
create index if not exists staff_shift_swap_requester_created_idx on public.staff_shift_swap_requests (requester_id, created_at desc);
create index if not exists staff_shift_swap_offered_created_idx on public.staff_shift_swap_requests (offered_to, created_at desc);
create unique index if not exists staff_shift_swap_one_pending_per_shift_idx on public.staff_shift_swap_requests (shift_id) where status = 'pending';
create index if not exists staff_audit_log_created_idx on public.staff_audit_log (created_at desc);
create index if not exists staff_audit_log_entity_idx on public.staff_audit_log (entity_type, entity_id, created_at desc);

drop trigger if exists set_updated_at on public.staff_shift_swap_requests;
create trigger set_updated_at before update on public.staff_shift_swap_requests
for each row execute function public.set_updated_at();

alter table public.staff_notifications enable row level security;
alter table public.staff_shift_swap_requests enable row level security;
alter table public.staff_audit_log enable row level security;
revoke all on public.staff_notifications from anon, authenticated;
revoke all on public.staff_shift_swap_requests from anon, authenticated;
revoke all on public.staff_audit_log from anon, authenticated;
grant all on public.staff_notifications to service_role;
grant all on public.staff_shift_swap_requests to service_role;
grant all on public.staff_audit_log to service_role;

comment on table public.staff_notifications is 'Private in-app staff notifications. No email or SMS delivery is performed.';
comment on table public.staff_shift_swap_requests is 'Manager-reviewed requests to reassign a future published shift to another active employee.';
comment on table public.staff_audit_log is 'Append-only staff operations history. It is not an attendance or payroll record.';
-- V2 Restaurant Operations — Module 5: Contact Us inbox.
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null default '',
  subject text not null,
  message text not null,
  status text not null default 'new',
  admin_note text not null default '',
  handled_by uuid references public.staff_profiles(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_messages_name_length check (length(trim(name)) between 2 and 100),
  constraint contact_messages_email_length check (length(trim(email)) between 3 and 254),
  constraint contact_messages_phone_length check (length(phone) <= 30),
  constraint contact_messages_subject_length check (length(trim(subject)) between 2 and 80),
  constraint contact_messages_message_length check (length(trim(message)) between 10 and 2000),
  constraint contact_messages_note_length check (length(admin_note) <= 1000),
  constraint contact_messages_status_valid check (status in ('new', 'in_progress', 'resolved', 'archived'))
);

create index if not exists contact_messages_status_created_idx
on public.contact_messages (status, created_at desc);

create index if not exists contact_messages_created_idx
on public.contact_messages (created_at desc);

drop trigger if exists set_updated_at on public.contact_messages;
create trigger set_updated_at
before update on public.contact_messages
for each row execute function public.set_updated_at();

alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from anon, authenticated;
grant all on public.contact_messages to service_role;

comment on table public.contact_messages is
  'Customer contact submissions managed privately by Owner and Manager through the server API.';

-- V2 Module 6: hashed Gift Cards, atomic checkout redemption and refund history.
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

create index if not exists gift_cards_status_created_idx on public.gift_cards (status, created_at desc);
create index if not exists gift_cards_recipient_email_idx on public.gift_cards (recipient_email) where recipient_email is not null;
create index if not exists gift_card_transactions_card_created_idx on public.gift_card_transactions (gift_card_id, created_at desc);
create index if not exists gift_card_transactions_order_idx on public.gift_card_transactions (order_id) where order_id is not null;

drop trigger if exists set_updated_at on public.gift_cards;
create trigger set_updated_at before update on public.gift_cards
for each row execute function public.set_updated_at();

alter table public.gift_cards enable row level security;
alter table public.gift_card_transactions enable row level security;
revoke all on public.gift_cards from anon, authenticated;
revoke all on public.gift_card_transactions from anon, authenticated;
grant all on public.gift_cards to service_role;
grant all on public.gift_card_transactions to service_role;

create or replace function public.issue_gift_card(
  p_code_hash text, p_code_last_four text, p_initial_balance numeric,
  p_recipient_name text, p_recipient_email text, p_note text,
  p_expires_on date, p_issued_by uuid
)
returns table (gift_card_id uuid)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_gift_card_id uuid;
  v_balance numeric(10,2) := round(p_initial_balance, 2);
begin
  if length(p_code_hash) <> 64 or length(p_code_last_four) <> 4 then raise exception 'Invalid gift card code metadata'; end if;
  if v_balance <= 0 or v_balance > 10000 then raise exception 'Gift card amount must be between 0.01 and 10000'; end if;
  if p_expires_on is not null and p_expires_on < current_date then raise exception 'Gift card expiry must be today or later'; end if;
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
  ) values (v_gift_card_id, 'issue', v_balance, v_balance, p_issued_by, 'Gift card issued');
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
returns table (order_number text, gift_card_amount numeric, gift_card_balance numeric, final_payment_method text)
language plpgsql security definer set search_path = public, pg_temp
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
    select * into v_gift_card from public.gift_cards where code_hash = p_gift_card_hash for update;
    if not found then raise exception 'GIFT_CARD_INVALID'; end if;
    if v_gift_card.status <> 'active' then raise exception 'GIFT_CARD_INACTIVE'; end if;
    if v_gift_card.expires_on is not null and v_gift_card.expires_on < current_date then raise exception 'GIFT_CARD_EXPIRED'; end if;
    if v_gift_card.balance <= 0 then raise exception 'GIFT_CARD_EMPTY'; end if;
    v_gift_amount := round(least(v_gift_card.balance, p_total), 2);
    v_payment_method := case when v_gift_amount >= p_total then 'Gift Card' else 'Gift Card + ' || p_payment_method end;
  end if;
  select created.order_number into v_order_number
  from public.create_checkout_order(
    p_first_name, p_last_name, p_phone, p_phone_normalized, p_email,
    p_fulfillment_type, p_pickup_time, p_address, p_city, p_zip, p_apartment,
    v_payment_method, p_subtotal, p_tax, p_delivery_fee, p_total, p_note, p_items
  ) as created limit 1;
  select id into v_order_id from public.orders where orders.order_number = v_order_number;
  if v_gift_amount > 0 then
    update public.orders set gift_card_id = v_gift_card.id, gift_card_amount = v_gift_amount where id = v_order_id;
    update public.gift_cards set
      balance = round(balance - v_gift_amount, 2),
      status = case when round(balance - v_gift_amount, 2) <= 0 then 'redeemed' else status end
    where id = v_gift_card.id returning balance into v_remaining;
    insert into public.gift_card_transactions (
      gift_card_id, transaction_type, amount, balance_after, order_id, note
    ) values (v_gift_card.id, 'redeem', -v_gift_amount, v_remaining, v_order_id, 'Redeemed on order ' || v_order_number);
  else
    v_remaining := null;
  end if;
  return query select v_order_number, v_gift_amount, v_remaining, v_payment_method;
end;
$$;

create or replace function public.update_order_status_with_gift_card(
  p_order_number text, p_status text, p_actor_id uuid
)
returns table (order_number text, order_status text, gift_card_refund numeric)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_card public.gift_cards%rowtype;
  v_refund numeric(10,2) := 0;
  v_balance numeric(10,2);
begin
  if p_status not in ('New', 'Preparing', 'Ready', 'Completed', 'Cancelled') then raise exception 'Invalid order status'; end if;
  select * into v_order from public.orders where orders.order_number = p_order_number for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status = 'Cancelled' and p_status <> 'Cancelled' then raise exception 'ORDER_CANCELLED_FINAL'; end if;
  if p_status = 'Cancelled' and v_order.status <> 'Cancelled' and v_order.gift_card_id is not null and v_order.gift_card_amount > 0 then
    select * into v_card from public.gift_cards where id = v_order.gift_card_id for update;
    if found then
      v_refund := v_order.gift_card_amount;
      v_balance := least(v_card.initial_balance, round(v_card.balance + v_refund, 2));
      update public.gift_cards set
        balance = v_balance,
        status = case when status = 'redeemed' and v_balance > 0 then 'active' else status end
      where id = v_card.id;
      insert into public.gift_card_transactions (
        gift_card_id, transaction_type, amount, balance_after, order_id, created_by, note
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

-- The authoritative additive Customer Accounts, Stripe, encrypted Gift Card and
-- loyalty schema is versioned separately to keep production rollout explicit:
-- migrations/20260824000100_v2_customer_accounts_payments_loyalty.sql
