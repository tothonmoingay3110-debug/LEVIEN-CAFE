-- LEVIEN production topping master data and product mappings.
insert into public.toppings (name, price, active)
values
  ('Coffee jelly', .95, true), ('Crystal boba', 1.25, true), ('Sugar boba', 1.25, true),
  ('Egg pudding', 1.50, true), ('Aloe vera', .95, true), ('Fruit jelly', .95, true),
  ('Lychee jelly', .95, true), ('Mango jelly', .95, true), ('Coconut jelly', .95, true),
  ('Taro pudding', 1.50, true), ('Grass jelly', 1.25, true), ('Whipped cream', .50, true),
  ('Strawberry jelly', .95, true), ('Passionfruit jelly', .95, true),
  ('Pate', .50, true), ('Extra jalapeños', .50, true), ('Extra house mayo', .50, true),
  ('Extra pickled salad', .50, true), ('Extra cucumber', .50, true), ('Extra cilantro', .50, true),
  ('Extra rice', 2.00, true), ('Extra veggie', 2.00, true), ('Extra fish sauce', 1.00, true),
  ('Extra grilled pork', 3.50, true), ('Extra grilled shrimp', 3.50, true),
  ('Extra popcorn shrimp', 3.50, true), ('Extra grilled shredded chicken', 3.50, true),
  ('Extra shredded pork skin', 3.50, true), ('Extra egg roll', 1.50, true), ('Egg', 1.50, true)
on conflict (name) do update set price = excluded.price, active = true, updated_at = now();

delete from public.product_toppings pt
using public.products p, public.categories c
where pt.product_id = p.id
  and p.category_id = c.id
  and c.name in ('Vietnamese Coffee', 'Classic Milk Tea', 'Fruit Tea', 'Other', 'Smoothies', 'Matcha', 'Vietnamese Hoagies', 'Broken Rice', 'Vermicelli');

insert into public.product_toppings (product_id, topping_id)
select p.id, t.id
from public.products p
join public.categories c on c.id = p.category_id
join public.toppings t on (
  (c.name in ('Vietnamese Coffee', 'Classic Milk Tea', 'Fruit Tea', 'Other', 'Smoothies', 'Matcha') and t.name in
    ('Coffee jelly', 'Crystal boba', 'Sugar boba', 'Egg pudding', 'Aloe vera', 'Fruit jelly', 'Lychee jelly', 'Mango jelly', 'Coconut jelly', 'Taro pudding', 'Grass jelly', 'Whipped cream', 'Strawberry jelly', 'Passionfruit jelly'))
  or (c.name = 'Vietnamese Hoagies' and t.name in
    ('Pate', 'Extra jalapeños', 'Extra house mayo', 'Extra pickled salad', 'Extra cucumber', 'Extra cilantro'))
  or (c.name in ('Broken Rice', 'Vermicelli') and t.name in
    ('Extra rice', 'Extra veggie', 'Extra fish sauce', 'Extra grilled pork', 'Extra grilled shrimp', 'Extra popcorn shrimp', 'Extra grilled shredded chicken', 'Extra shredded pork skin', 'Extra egg roll', 'Egg'))
)
on conflict do nothing;

update public.products p
set allow_toppings = c.name in ('Vietnamese Coffee', 'Classic Milk Tea', 'Fruit Tea', 'Other', 'Smoothies', 'Matcha', 'Vietnamese Hoagies', 'Broken Rice', 'Vermicelli'),
    updated_at = now()
from public.categories c
where p.category_id = c.id;

delete from public.toppings
where name in ('Boba', 'Egg Cream', 'Extra Espresso Shot', 'Salted Cream')
  and not exists (select 1 from public.product_toppings where topping_id = toppings.id);
