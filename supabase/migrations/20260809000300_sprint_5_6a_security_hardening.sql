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
