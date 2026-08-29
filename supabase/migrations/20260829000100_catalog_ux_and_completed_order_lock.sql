-- LEVIEN CAFE — catalog UX fields and final completed-order state.

alter table public.products add column if not exists sku text;
update public.products
set sku = 'LV-' || upper(replace(id::text, '-', ''))
where sku is null or btrim(sku) = '';

-- Repair duplicate values left by an earlier interrupted run of this migration.
with ranked_skus as (
  select id, row_number() over (partition by upper(sku) order by id) as duplicate_position
  from public.products
  where sku is not null and btrim(sku) <> ''
)
update public.products as product
set sku = 'LV-' || upper(replace(product.id::text, '-', ''))
from ranked_skus
where ranked_skus.id = product.id and ranked_skus.duplicate_position > 1;
alter table public.products alter column sku set not null;
create unique index if not exists products_sku_unique_idx on public.products (upper(sku));

alter table public.toppings add column if not exists image_url text;

-- Counter-created members may initially have no online login or email.
alter table public.customer_profiles alter column auth_user_id drop not null;
alter table public.customer_profiles alter column email drop not null;
alter table public.customer_profiles drop constraint if exists customer_profiles_email_length;
alter table public.customer_profiles add constraint customer_profiles_email_length
check (email is null or length(email) between 3 and 254);
create unique index if not exists customer_profiles_phone_unique_idx
on public.customer_profiles (regexp_replace(phone, '\D', '', 'g'))
where regexp_replace(phone, '\D', '', 'g') <> '';

create or replace function public.prevent_completed_order_reopen()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if old.status = 'Completed' and new.status is distinct from old.status then
    raise exception 'ORDER_COMPLETED_FINAL';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_completed_order_reopen on public.orders;
create trigger prevent_completed_order_reopen
before update of status on public.orders
for each row execute function public.prevent_completed_order_reopen();

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
    on conflict (id) do update set name=excluded.name, icon=excluded.icon, active=excluded.active, sort_order=excluded.sort_order, updated_at=now();
  end loop;

  for v_item in select value from jsonb_array_elements(p_catalog->'toppings') loop
    insert into public.toppings (id, name, price, image_url, active)
    values ((v_item->>'id')::uuid, v_item->>'name', (v_item->>'price')::numeric, nullif(v_item->>'image', ''), coalesce((v_item->>'active')::boolean, true))
    on conflict (id) do update set name=excluded.name, price=excluded.price, image_url=excluded.image_url, active=excluded.active, updated_at=now();
  end loop;

  for v_item, v_position in select value, ordinality from jsonb_array_elements(p_catalog->'products') with ordinality loop
    v_parent_id := (v_item->>'id')::uuid;
    insert into public.products (
      id, sku, category_id, name, description, price, image_url, emoji, allow_ice, allow_sugar,
      allow_toppings, best_seller, must_try, featured, is_new, sold_out, active, sort_order
    ) values (
      v_parent_id, upper(btrim(v_item->>'sku')), nullif(v_item->>'categoryId', '')::uuid, v_item->>'name', nullif(v_item->>'description', ''),
      (v_item->>'price')::numeric, nullif(v_item->>'image', ''), coalesce(nullif(v_item->>'emoji', ''), '☕'),
      coalesce((v_item->>'allowIce')::boolean, false), coalesce((v_item->>'allowSugar')::boolean, false),
      coalesce((v_item->>'allowToppings')::boolean, false), coalesce((v_item->>'bestSeller')::boolean, false),
      coalesce((v_item->>'mustTry')::boolean, false), coalesce((v_item->>'featured')::boolean, false),
      coalesce((v_item->>'isNew')::boolean, false), coalesce((v_item->>'soldOut')::boolean, false),
      coalesce((v_item->>'active')::boolean, true), v_position
    ) on conflict (id) do update set
      sku=excluded.sku, category_id=excluded.category_id, name=excluded.name, description=excluded.description,
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
    values (v_parent_id, v_item->>'name', nullif(v_item->>'description', ''), (v_item->>'price')::numeric, nullif(v_item->>'image', ''), coalesce((v_item->>'active')::boolean, true), v_position)
    on conflict (id) do update set name=excluded.name, description=excluded.description, price=excluded.price, image_url=excluded.image_url, active=excluded.active, sort_order=excluded.sort_order, updated_at=now();
    delete from public.combo_products where combo_id = v_parent_id;
    for v_link, v_position in select value, ordinality from jsonb_array_elements(coalesce(v_item->'productIds', '[]'::jsonb)) with ordinality loop
      insert into public.combo_products (combo_id, product_id, position)
      values (v_parent_id, trim(both '"' from v_link::text)::uuid, v_position) on conflict do nothing;
    end loop;
  end loop;

  for v_item, v_position in select value, ordinality from jsonb_array_elements(p_catalog->'promotions') with ordinality loop
    insert into public.promotions (id, name, eyebrow, description, price_text, image_url, starts_on, ends_on, active, sort_order)
    values ((v_item->>'id')::uuid, v_item->>'title', nullif(v_item->>'eyebrow', ''), nullif(v_item->>'description', ''), nullif(v_item->>'priceText', ''), nullif(v_item->>'image', ''), coalesce(nullif(v_item->>'startDate', '')::date, current_date), nullif(v_item->>'endDate', '')::date, coalesce((v_item->>'active')::boolean, true), coalesce((v_item->>'order')::integer, v_position::integer))
    on conflict (id) do update set name=excluded.name, eyebrow=excluded.eyebrow, description=excluded.description, price_text=excluded.price_text, image_url=excluded.image_url, starts_on=excluded.starts_on, ends_on=excluded.ends_on, active=excluded.active, sort_order=excluded.sort_order, updated_at=now();
  end loop;
end;
$$;

revoke all on function public.save_admin_catalog(jsonb) from public;
grant execute on function public.save_admin_catalog(jsonb) to service_role;
