alter table public.staff_profiles
add column if not exists avatar_url text;

create table if not exists public.reward_items (
  id uuid primary key default gen_random_uuid(),
  sku text not null,
  name text not null,
  image_url text,
  stock_quantity integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reward_items_sku_length check (length(trim(sku)) between 2 and 64),
  constraint reward_items_name_length check (length(trim(name)) between 2 and 120),
  constraint reward_items_stock_valid check (stock_quantity >= 0)
);

create unique index if not exists reward_items_sku_unique_idx on public.reward_items (upper(sku));
alter table public.loyalty_rules add column if not exists reward_item_id uuid references public.reward_items(id) on delete restrict;
alter table public.loyalty_rewards add column if not exists reward_item_id uuid references public.reward_items(id) on delete restrict;

create or replace function public.copy_loyalty_reward_item()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.reward_type = 'physical_gift' and new.reward_item_id is null then
    select reward_item_id into new.reward_item_id from public.loyalty_rules where id = new.rule_id;
  end if;
  return new;
end;
$$;

drop trigger if exists copy_loyalty_reward_item on public.loyalty_rewards;
create trigger copy_loyalty_reward_item before insert on public.loyalty_rewards
for each row execute function public.copy_loyalty_reward_item();

create or replace function public.fulfill_physical_reward_v2(p_reward_id uuid, p_staff_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_item_id uuid;
begin
  select reward_item_id into v_item_id from public.loyalty_rewards
  where id = p_reward_id and reward_type = 'physical_gift' and status = 'issued' for update;
  if not found then raise exception 'Reward is no longer available'; end if;
  if v_item_id is null then raise exception 'Reward item is not configured'; end if;
  update public.reward_items set stock_quantity = stock_quantity - 1, updated_at = now()
  where id = v_item_id and active = true and stock_quantity > 0;
  if not found then raise exception 'Physical gift is out of stock'; end if;
  update public.loyalty_rewards set status = 'redeemed', redeemed_at = now(), redeemed_by = p_staff_id, updated_at = now()
  where id = p_reward_id;
  return v_item_id;
end;
$$;

alter table public.reward_items enable row level security;
revoke all on public.reward_items from anon, authenticated;
grant all on public.reward_items to service_role;
grant execute on function public.fulfill_physical_reward_v2(uuid, uuid) to service_role;

drop trigger if exists set_updated_at on public.reward_items;
create trigger set_updated_at before update on public.reward_items
for each row execute function public.set_updated_at();
