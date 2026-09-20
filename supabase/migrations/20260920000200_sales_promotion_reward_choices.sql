alter table public.sales_promotions
  add column if not exists reward_product_ids uuid[] not null default '{}';

update public.sales_promotions
set reward_product_ids = array[reward_product_id]
where reward_product_id is not null and cardinality(reward_product_ids) = 0;

alter table public.sales_promotions drop constraint if exists sales_promotions_buy_get_reward;
alter table public.sales_promotions add constraint sales_promotions_buy_get_reward
  check (promotion_type <> 'buy_x_get_y' or cardinality(reward_product_ids) > 0 or reward_topping_id is not null);

create index if not exists sales_promotions_reward_products_idx
  on public.sales_promotions using gin(reward_product_ids);
