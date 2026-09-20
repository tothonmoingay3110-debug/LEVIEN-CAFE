create table if not exists public.sales_promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  badge_text text not null default 'Special offer' check (length(badge_text) between 1 and 40),
  description text not null default '',
  promotion_type text not null check (promotion_type in ('percent_off','fixed_off','buy_x_get_y')),
  scope_type text not null check (scope_type in ('all','products','categories','combos')),
  target_ids uuid[] not null default '{}',
  discount_value numeric(10,2) not null default 0 check (discount_value >= 0),
  buy_quantity integer not null default 1 check (buy_quantity between 1 and 100),
  get_quantity integer not null default 1 check (get_quantity between 1 and 100),
  reward_product_id uuid references public.products(id) on delete set null,
  reward_topping_id uuid references public.toppings(id) on delete set null,
  minimum_subtotal numeric(10,2) not null default 0 check (minimum_subtotal >= 0),
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  usage_count integer not null default 0 check (usage_count >= 0),
  starts_on date not null,
  ends_on date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_promotions_dates_valid check (ends_on >= starts_on),
  constraint sales_promotions_percent_valid check (promotion_type <> 'percent_off' or discount_value between 0.01 and 100),
  constraint sales_promotions_fixed_valid check (promotion_type <> 'fixed_off' or discount_value > 0),
  constraint sales_promotions_buy_get_reward check (promotion_type <> 'buy_x_get_y' or reward_product_id is not null or reward_topping_id is not null)
);

create index if not exists sales_promotions_live_idx on public.sales_promotions(active, starts_on, ends_on);
create index if not exists sales_promotions_targets_idx on public.sales_promotions using gin(target_ids);
drop trigger if exists set_updated_at on public.sales_promotions;
create trigger set_updated_at before update on public.sales_promotions for each row execute function public.set_updated_at();

alter table public.sales_promotions enable row level security;
revoke all on public.sales_promotions from anon, authenticated;
grant all on public.sales_promotions to service_role;

drop policy if exists "Public can read live sales promotions" on public.sales_promotions;
create policy "Public can read live sales promotions"
on public.sales_promotions for select to anon, authenticated
using (active and starts_on <= current_date and ends_on >= current_date and (usage_limit is null or usage_count < usage_limit));

alter table public.orders add column if not exists sales_promotion_id uuid references public.sales_promotions(id) on delete set null;
alter table public.orders add column if not exists promotion_discount numeric(10,2) not null default 0 check (promotion_discount >= 0);
alter table public.orders add column if not exists promotion_snapshot jsonb;

create or replace function public.increment_sales_promotion_usage(promotion_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.sales_promotions
  set usage_count = usage_count + 1, updated_at = now()
  where id = promotion_id and (usage_limit is null or usage_count < usage_limit);
$$;
revoke all on function public.increment_sales_promotion_usage(uuid) from public, anon, authenticated;
grant execute on function public.increment_sales_promotion_usage(uuid) to service_role;
